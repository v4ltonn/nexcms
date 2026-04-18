const express = require('express');
const router = express.Router();

// Admin dashboard
router.get('/', (req, res) => {
  res.json({ message: 'Admin panel' });
});

module.exports = router;
