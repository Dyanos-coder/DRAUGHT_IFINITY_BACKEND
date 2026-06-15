const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// GET /api/matches/recent-for-dispute - Get recent matches for a user to select for a dispute
router.get('/recent-for-dispute', verifyToken, matchController.getRecentMatchesForDispute);

// Add other match-specific routes here, for example:
// router.get('/:matchId', verifyToken, matchController.getMatchDetails);
// router.post('/:matchId/report-score', verifyToken, matchController.reportScore);

module.exports = router; 