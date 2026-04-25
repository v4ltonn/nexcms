/**
 * Slightly modify titles to avoid exact duplicates from source
 * Makes titles unique while keeping them SEO-friendly and natural
 */
function varyTitle(originalTitle) {
  // When local LLM pipeline is enabled, title variation helps even before LLM rewrite runs.
  const llmOn = process.env.USE_LOCAL_LLM === '1' || process.env.USE_LOCAL_LLM === 'true'
    || process.env.USE_LLM_UNIQUENESS === '1' || process.env.USE_LLM_UNIQUENESS === 'true';
  if (process.env.ENABLE_TITLE_VARIATION === 'false') {
    return originalTitle;
  }
  if (process.env.ENABLE_TITLE_VARIATION !== 'true' && !llmOn) {
    return originalTitle;
  }

  if (!originalTitle || typeof originalTitle !== 'string') {
    return originalTitle;
  }
  
  const title = originalTitle.trim();
  if (title.length < 10) return title;
  
  // Variations to apply (randomly choose one)
  const variations = [
    // Prefix variations
    () => {
      if (title.toLowerCase().startsWith('breaking:') || title.toLowerCase().startsWith('breaking ')) {
        return title; // Don't modify if already has breaking
      }
      const prefixes = ['Breaking: ', 'Latest: ', 'Update: ', 'Report: '];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + title;
    },
    
    // Suffix variations
    () => {
      if (title.endsWith('...') || title.endsWith('2025') || title.endsWith('2026')) {
        return title; // Don't modify if already has year or ellipsis
      }
      const suffixes = [' - 2025 Update', ' - Complete Guide', ' - Full Analysis', ' - Expert Insights'];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      return title + suffix;
    },
    
    // Word rearrangement (for longer titles)
    () => {
      if (title.length < 40) return title;
      const words = title.split(' ');
      if (words.length < 5) return title;
      
      // Move first word to end occasionally
      if (Math.random() > 0.7 && words.length > 6) {
        const firstWord = words.shift();
        words.push(firstWord);
        return words.join(' ');
      }
      return title;
    },
    
    // Add context words
    () => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('guide') || lowerTitle.includes('tutorial') || lowerTitle.includes('how to')) {
        return title; // Already has guide words
      }
      
      const contextWords = ['Complete Guide to ', 'Essential Guide: ', 'Ultimate Guide: '];
      const contextWord = contextWords[Math.floor(Math.random() * contextWords.length)];
      
      // Only add if title doesn't start with these
      if (!lowerTitle.startsWith('complete') && !lowerTitle.startsWith('essential') && !lowerTitle.startsWith('ultimate')) {
        return contextWord + title;
      }
      return title;
    },
    
    // Capitalize and add emphasis
    () => {
      // Just return original - this variation is too obvious
      return title;
    }
  ];
  
  // Always apply some variation (80% chance of significant variation, 20% subtle)
  const applyVariation = Math.random() < 0.8;
  
  if (applyVariation) {
    const variation = variations[Math.floor(Math.random() * variations.length)];
    const modified = variation();
    
    // Ensure modified title isn't too long (max 200 chars)
    if (modified.length > 200) {
      const result = modified.substring(0, 197) + '...';
      return result;
    }
    
    // Only return modified if it's different and reasonable
    if (modified !== title && modified.length > title.length * 0.8) {
      return modified;
    }
  }
  
  // If no variation was applied or it didn't change, add subtle variation
  // Add year or update indicator if not present
  const currentYear = new Date().getFullYear();
  const hasYear = /\b(202[4-6]|2025|2026)\b/.test(title);
  
  if (!hasYear) {
    // Add year in a natural way (60% chance)
    if (title.length < 180 && Math.random() < 0.6) {
      return `${title} (${currentYear})`;
    }
  }
  
  // Remove trailing ellipsis and trim
  let result = title;
  if (result.endsWith('...')) {
    result = result.slice(0, -3).trim();
  }
  
  // If still unchanged, add a subtle prefix/suffix (40% chance)
  if (result === title && Math.random() < 0.4) {
    const subtleMods = [
      () => `Latest: ${result}`,
      () => `Update: ${result}`,
      () => `${result} - Analysis`,
      () => `${result} - Guide`
    ];
    const mod = subtleMods[Math.floor(Math.random() * subtleMods.length)];
    const final = mod();
    return final.length > 200 ? final.substring(0, 197) + '...' : final;
  }
  
  return result;
}

module.exports = { varyTitle };
