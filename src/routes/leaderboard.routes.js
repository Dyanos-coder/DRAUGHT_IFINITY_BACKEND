const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Route pour obtenir le rang de l'utilisateur connecté
router.get('/user-ranks', verifyToken, leaderboardController.getUserRanks);

// Route pour obtenir le classement par gains
router.get('/earnings', verifyToken, leaderboardController.getEarningsLeaderboard);

// Route pour obtenir le classement par filleuls
router.get('/referrals', verifyToken, leaderboardController.getReferralsLeaderboard);

// Route pour obtenir le classement par points de fidélité
router.get('/fidelity', verifyToken, leaderboardController.getFidelityLeaderboard);

// Route pour obtenir le classement par participation
router.get('/participation', verifyToken, leaderboardController.getParticipationLeaderboard);

// Route pour obtenir le classement par jeu
router.get('/game/:gameId', verifyToken, leaderboardController.getGameLeaderboard);

module.exports = router;