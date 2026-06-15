const Reward = require('../models/reward.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const rewardService = require('../services/rewardService');

// Collecter une récompense
exports.collectReward = async (req, res) => {
  try {
    const { userId } = req;
    const { id: rewardId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non authentifié.' });
    }

    const result = await rewardService.claimReward(userId, rewardId);

    res.status(200).json({
      message: 'Récompense réclamée avec succès.',
      updatedReward: result.reward,
      updatedUser: {
        _id: result.user._id,
        solde: result.user.solde,
        pointsDeFidelite: result.user.pointsDeFidelite,
        ticketsDeTournois: result.user.ticketsDeTournois
      }
    });

  } catch (error) {
    console.error("Erreur lors de la réclamation de la récompense:", error.message);
    if (error.message === 'Récompense non trouvée.' || error.message === 'Utilisateur non trouvé.') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Cette récompense ne vous appartient pas.') {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === 'Cette récompense a déjà été réclamée.') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Erreur serveur lors de la réclamation de la récompense.', details: error.message });
  }
};

// Obtenir les récompenses de l'utilisateur
exports.getUserRewards = async (req, res) => {
  try {
    const rewards = await Reward.find({ userId: req.userId })
      .populate('tournamentId', 'title')
      .sort({ date: -1 });

    res.status(200).json({ rewards });
  } catch (error) {
    console.error("Erreur lors de la récupération des récompenses:", error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
}; 