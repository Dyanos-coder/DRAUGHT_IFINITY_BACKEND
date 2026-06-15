const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/reward.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Obtenir les récompenses de l'utilisateur
router.get('/user', verifyToken, rewardController.getUserRewards);

// Collecter une récompense
router.post('/:id/collect', verifyToken, rewardController.collectReward);

module.exports = router; 