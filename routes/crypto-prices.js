const express = require('express');
const router = express.Router();

// Top cryptocurrencies to display
const TOP_CRYPTO_IDS = [
  'bitcoin',      // BTC
  'ethereum',     // ETH
  'binancecoin',  // BNB
  'solana',       // SOL
  'cardano',      // ADA
  'ripple',       // XRP
  'polkadot',     // DOT
  'dogecoin',     // DOGE
  'avalanche-2',  // AVAX
  'chainlink',    // LINK
  'polygon',      // MATIC
  'litecoin'      // LTC
];

// Fetch crypto prices from CoinGecko API (free, no API key needed)
router.get('/', async (req, res) => {
  try {
    const ids = TOP_CRYPTO_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map to friendly format
    const cryptoMap = {
      'bitcoin': { symbol: 'BTC', name: 'Bitcoin' },
      'ethereum': { symbol: 'ETH', name: 'Ethereum' },
      'binancecoin': { symbol: 'BNB', name: 'Binance Coin' },
      'solana': { symbol: 'SOL', name: 'Solana' },
      'cardano': { symbol: 'ADA', name: 'Cardano' },
      'ripple': { symbol: 'XRP', name: 'Ripple' },
      'polkadot': { symbol: 'DOT', name: 'Polkadot' },
      'dogecoin': { symbol: 'DOGE', name: 'Dogecoin' },
      'avalanche-2': { symbol: 'AVAX', name: 'Avalanche' },
      'chainlink': { symbol: 'LINK', name: 'Chainlink' },
      'polygon': { symbol: 'MATIC', name: 'Polygon' },
      'litecoin': { symbol: 'LTC', name: 'Litecoin' }
    };
    
    const prices = Object.entries(data).map(([id, info]) => {
      const crypto = cryptoMap[id];
      if (!crypto) return null;
      
      return {
        id,
        symbol: crypto.symbol,
        name: crypto.name,
        price: info.usd || 0,
        change24h: info.usd_24h_change || 0,
        volume24h: info.usd_24h_vol || 0,
        marketCap: info.usd_market_cap || 0
      };
    }).filter(Boolean);
    
    // Sort: BTC first, then by market cap (popularity)
    prices.sort((a, b) => {
      // BTC always first
      if (a.symbol === 'BTC') return -1;
      if (b.symbol === 'BTC') return 1;
      
      // Then sort by market cap (descending - highest first)
      return (b.marketCap || 0) - (a.marketCap || 0);
    });
    
    res.json({
      success: true,
      prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Crypto prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crypto prices',
      error: error.message
    });
  }
});

module.exports = router;

