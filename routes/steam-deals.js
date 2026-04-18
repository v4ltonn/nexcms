const express = require('express');
const router = express.Router();

// Fetch Steam deals from CheapShark API
router.get('/', async (req, res) => {
  try {
    const { limit = 20, maxPrice = 10 } = req.query;
    
    // Fetch deals from CheapShark API
    const response = await fetch(
      `https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=${maxPrice}&pageSize=${limit}&sortBy=DealRating&desc=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`CheapShark API error: ${response.status}`);
    }
    
    const deals = await response.json();
    
    // Format deals for frontend
    const formattedDeals = deals.map(deal => ({
      id: deal.dealID,
      title: deal.title,
      normalPrice: parseFloat(deal.normalPrice),
      salePrice: parseFloat(deal.salePrice),
      savings: parseFloat(deal.savings),
      discount: Math.round(parseFloat(deal.savings)),
      steamAppID: deal.steamAppID,
      thumb: deal.thumb,
      dealRating: parseFloat(deal.dealRating) || 0,
      releaseDate: deal.releaseDate,
      storeID: deal.storeID,
      dealUrl: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`
    }));
    
    res.json({
      success: true,
      deals: formattedDeals,
      count: formattedDeals.length
    });
  } catch (error) {
    console.error('Steam deals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Steam deals',
      error: error.message
    });
  }
});

// Get deal details
router.get('/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const response = await fetch(
      `https://www.cheapshark.com/api/1.0/deals?id=${dealId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`CheapShark API error: ${response.status}`);
    }
    
    const deal = await response.json();
    
    res.json({
      success: true,
      deal: deal.gameInfo || deal
    });
  } catch (error) {
    console.error('Steam deal details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deal details',
      error: error.message
    });
  }
});

module.exports = router;






