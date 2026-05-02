#!/usr/bin/env python3
"""Safe Sigma -> query converter for InfinitSec tools.

Supports multiple backends via the `target` field:
  - "kusto" (default): Microsoft Defender / M365 Defender KQL via KustoBackend
  - "elastic-lucene": Elasticsearch / Kibana Lucene query via LuceneBackend

Reads JSON from stdin:
  { "sigma": "<yaml text>", "target": "kusto" | "elastic-lucene" }

Writes JSON to stdout:
  { "success": true, "kql": "<query text>" }
  or
  { "success": false, "error": "message" }

The script enforces strict size limits and performs a light normalisation
of Sigma tags so that older rules without namespaced tags still convert.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, List, Optional, Tuple
import re

MAX_INPUT_CHARS = 50000  # hard limit, also enforced in Node
MAX_OUTPUT_CHARS = 50000


DEFENDER_TABLE_MAP: Dict[Tuple[str, str], str] = {
    ("windows", "process_creation"): "DeviceProcessEvents",
    ("windows", "process_creation_event"): "DeviceProcessEvents",
    ("windows", "network_connection"): "DeviceNetworkEvents",
    ("windows", "dns_query"): "DeviceNetworkEvents",
    ("windows", "file_event"): "DeviceFileEvents",
    ("windows", "file_create"): "DeviceFileEvents",
    ("windows", "registry_event"): "DeviceRegistryEvents",
    ("windows", "registry_set"): "DeviceRegistryEvents",
    ("windows", "image_load"): "DeviceImageLoadEvents",
    ("windows", "driver_load"): "DeviceImageLoadEvents",
}

DEFENDER_FIELD_MAP: Dict[str, str] = {
    "CommandLine": "ProcessCommandLine",
    "Image": "FolderPath",
    "ParentImage": "InitiatingProcessFolderPath",
    "ParentCommandLine": "InitiatingProcessCommandLine",
    "User": "AccountName",
    "ParentUser": "InitiatingProcessAccountName",
    "ProcessId": "ProcessId",
    "ParentProcessId": "InitiatingProcessId",
}


def _normalize_sigma_tags(yaml_text: str) -> str:
    """Best-effort normalisation for Sigma v1 tag format.

    Older Sigma rules often have bare tags like:
      tags: [process_creation, windows]

    Modern backends expect namespaced tags:
      tags: [category.process_creation, product.windows]

    To avoid hard failures we:
      - leave tags that already contain a dot as-is
      - prefix bare tags with "generic." (which is allowed but neutral)

    If parsing fails for any reason, we fall back to the original YAML.
    """
    try:
        import yaml  # type: ignore
    except Exception:
        return yaml_text

    try:
        docs: List[Any] = list(yaml.safe_load_all(yaml_text))
    except Exception:
        return yaml_text

    changed = False
    for doc in docs:
        if isinstance(doc, dict) and "tags" in doc:
            tags = doc.get("tags")
            if isinstance(tags, list):
                new_tags: List[str] = []
                for t in tags:
                    if not isinstance(t, str):
                        continue
                    t_clean = t.strip()
                    if not t_clean:
                        continue
                    if "." in t_clean:
                        new_tags.append(t_clean)
                    else:
                        new_tags.append(f"generic.{t_clean}")
                        changed = True
                doc["tags"] = new_tags

    if not changed:
        return yaml_text

    try:
        import yaml  # type: ignore

        return yaml.safe_dump_all(docs, sort_keys=False)
    except Exception:
        return yaml_text


def _expand_contains_list_rule(yaml_text: str) -> str:
    """Expand simple CommandLine|contains lists into OR selections.

    This targets the common pattern:
      detection:
        selection:
          CommandLine|contains:
            - a
            - b
        condition: selection
    And rewrites to:
      detection:
        selection_1: { CommandLine|contains: a }
        selection_2: { CommandLine|contains: b }
        condition: selection_1 or selection_2
    """
    try:
        import yaml  # type: ignore
    except Exception:
        return yaml_text

    try:
        docs: List[Any] = list(yaml.safe_load_all(yaml_text))
    except Exception:
        return yaml_text

    changed = False
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        detection = doc.get("detection")
        if not isinstance(detection, dict):
            continue
        selection = detection.get("selection")
        condition = detection.get("condition")
        if condition != "selection":
            continue
        if not isinstance(selection, dict):
            continue
        contains_key = None
        for key in selection.keys():
            if isinstance(key, str) and key.endswith("|contains"):
                contains_key = key
                break
        if not contains_key:
            continue
        values = selection.get(contains_key)
        if not isinstance(values, list) or not values:
            continue
        normalized_values: List[str] = []
        for v in values:
            if isinstance(v, str):
                normalized_values.append(v)
                continue
            if isinstance(v, dict) and len(v) == 1:
                key = next(iter(v.keys()))
                if isinstance(key, str) and v.get(key) is None:
                    # YAML treats "lsadump::" as a key with null value.
                    normalized_values.append(f"{key}:")
                    continue
            # Unsupported value type for this normalization.
            normalized_values = []
            break
        if not normalized_values:
            continue

        # Expand into multiple selections
        new_detection: Dict[str, Any] = {}
        selection_names: List[str] = []
        for idx, value in enumerate(normalized_values, start=1):
            name = f"selection_{idx}"
            selection_names.append(name)
            new_detection[name] = {contains_key: value}
        new_detection["condition"] = " or ".join(selection_names)

        # Preserve other detection keys if present (e.g., timeframe)
        for key, value in detection.items():
            if key in ("selection", "condition"):
                continue
            new_detection[key] = value

        doc["detection"] = new_detection
        changed = True

    if not changed:
        return yaml_text

    try:
        import yaml  # type: ignore
        return yaml.safe_dump_all(docs, sort_keys=False)
    except Exception:
        return yaml_text


def _guess_defender_table(rule: Any) -> Optional[str]:
    try:
        logsource = getattr(rule, "logsource", None)
        if not logsource:
            return None
        product = (getattr(logsource, "product", None) or "").lower()
        category = (getattr(logsource, "category", None) or "").lower()
        if not product and hasattr(logsource, "service"):
            product = (getattr(logsource, "service", None) or "").lower()
        return DEFENDER_TABLE_MAP.get((product, category))
    except Exception:
        return None


def _apply_defender_field_mapping(query: str) -> str:
    mapped = query
    for src, dst in DEFENDER_FIELD_MAP.items():
        mapped = re.sub(rf"\b{re.escape(src)}\b", dst, mapped)
    return mapped


def _ensure_table_prefix(query: str, table: Optional[str]) -> str:
    if not table:
        return query
    stripped = query.lstrip()
    if stripped.startswith(table):
        return query
    if stripped.startswith("|"):
        return f"{table}\n{query}"
    return f"{table}\n| {query}"


def _postprocess_kusto_queries(queries: List[str], table: Optional[str]) -> List[str]:
    processed: List[str] = []
    for q in queries:
        mapped = _apply_defender_field_mapping(q)
        mapped = _ensure_table_prefix(mapped, table)
        processed.append(mapped)
    return processed


def main() -> None:
    try:
        raw = sys.stdin.read()
        try:
            data = json.loads(raw or "{}")
        except Exception:
            print(json.dumps({"success": False, "error": "Invalid JSON payload."}))
            return

        sigma_text = data.get("sigma") or ""
        if not isinstance(sigma_text, str) or not sigma_text.strip():
            print(json.dumps({"success": False, "error": "Sigma rule is required."}))
            return

        if len(sigma_text) > MAX_INPUT_CHARS:
            print(json.dumps({"success": False, "error": "Sigma rule too large."}))
            return

        target = (data.get("target") or "kusto").lower()

        # Import heavy libraries lazily so the process starts fast when unused.
        try:
            from sigma.collection import SigmaCollection  # type: ignore
            from sigma.backends.kusto import KustoBackend  # type: ignore
            from sigma.backends.elasticsearch import LuceneBackend  # type: ignore
        except Exception as import_err:  # pragma: no cover - environment specific
            msg = (
                "Sigma conversion backends not installed. "
                "Please install 'pySigma', 'pySigma-backend-kusto' and "
                "'pySigma-backend-elasticsearch' in the server environment."
            )
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": f"{msg} ({str(import_err)[:120]})",
                    }
                )
            )
            return

        # Normalise tags so that older rules without namespaces still work.
        normalized_yaml = _normalize_sigma_tags(sigma_text)
        # Expand simple contains-list rules for compatibility.
        normalized_yaml = _expand_contains_list_rule(normalized_yaml)

        try:
            collection = SigmaCollection.from_yaml(normalized_yaml)
            if target == "elastic-lucene":
                backend = LuceneBackend()  # default: Lucene query string
            else:
                backend = KustoBackend()
            queries = backend.convert(collection) or []
        except Exception as conv_err:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": f"Conversion error: {str(conv_err)[:280]}",
                    }
                )
            )
            return

        if not queries:
            print(
                json.dumps(
                    {
                        "success": False,
                        "error": "No queries were generated from this Sigma rule.",
                    }
                )
            )
            return

        rendered_queries = [str(q) for q in queries]
        if target == "kusto":
            first_rule = collection.rules[0] if getattr(collection, "rules", None) else None
            table = _guess_defender_table(first_rule)
            rendered_queries = _postprocess_kusto_queries(rendered_queries, table)

        joined = "\n\n".join(rendered_queries)
        if len(joined) > MAX_OUTPUT_CHARS:
            joined = joined[: MAX_OUTPUT_CHARS - 80] + "\n\n// [truncated output]"

        print(json.dumps({"success": True, "kql": joined}))
    except Exception as fatal_err:  # pragma: no cover - extreme edge
        print(
            json.dumps(
                {
                    "success": False,
                    "error": f"Unexpected converter failure: {str(fatal_err)[:280]}",
                }
            )
        )


if __name__ == "__main__":
    main()


