const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
const transactionController = require('../controllers/transaction.controller');
const tournamentController = require('../controllers/tournament.controller');
const User = require('../models/user.model');
const gameDatabaseService = require('../services/gameDatabaseService');

// Routes pour le profil utilisateur
router.get('/profile', verifyToken, userController.getUserProfile);
router.put('/profile', verifyToken, userController.updateProfile);
router.put('/avatar', verifyToken, userController.updateAvatar);
router.put('/password', verifyToken, userController.updatePassword);
router.put('/currency', verifyToken, userController.updatePreferredCurrency);

// Route pour récupérer les tournois de l'utilisateur
router.get('/tournaments', verifyToken, tournamentController.getUserTournaments);

// Routes pour les statistiques de l'utilisateur
router.get('/me/statistics', verifyToken, userController.getUserOverallStats);
router.get('/me/match-history', verifyToken, userController.getUserMatchHistory);
router.get('/me/monthly-performance', verifyToken, userController.getUserMonthlyPerformance);

// Routes pour les transactions
router.get('/transactions', verifyToken, transactionController.getUserTransactions);
router.get('/transactions/summary', verifyToken, transactionController.getTransactionsSummary);
router.get('/transactions/monthly-gains', verifyToken, transactionController.getMonthlyGains);
router.get('/transactions/:id', verifyToken, transactionController.getTransactionById);
router.post('/transactions', verifyToken, transactionController.createTransaction);

// Nouvelle route pour mettre à jour le rôle
router.put('/role', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { role } = req.body;

    // Vérifier que le rôle demandé est valide
    if (role !== 'validator') {
      return res.status(400).json({
        message: 'Rôle non valide. Seul le rôle "validator" est autorisé.'
      });
    }

    // Mettre à jour le rôle de l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du rôle:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour du rôle',
      error: error.message
    });
  }
});

// Route pour acheter un thème - travaille directement avec la base du jeu
router.post('/purchase-theme', verifyToken, async (req, res) => {
  try {
    const { type, path, price } = req.body;

    // Validation
    if (!type || !path || !price) {
      return res.status(400).json({ message: 'Type, path et price requis' });
    }

    if (!['board', 'background'].includes(type)) {
      return res.status(400).json({ message: 'Type invalide' });
    }

    // Vérifier que c'est un token de Player
    if (!req.user || !req.user.playerId || !req.user.gameId) {
      return res.status(400).json({ message: 'Token de jeu requis' });
    }

    console.log('🎮 Token de Player - playerId:', req.user.playerId, 'gameId:', req.user.gameId);

    // Obtenir la connexion à la base de données du jeu
    const connection = gameDatabaseService.getGameConnection(req.user.gameId);

    if (!connection) {
      return res.status(500).json({ message: 'Connexion à la base du jeu non disponible' });
    }

    const Player = connection.model('Player');

    // Récupérer le joueur
    const player = await Player.findById(req.user.playerId);

    if (!player) {
      return res.status(404).json({ message: 'Joueur non trouvé' });
    }

    console.log('👤 Joueur trouvé:', player.inGameUsername, 'Solde:', player.soldePiece);

    // Vérifier si le joueur possède déjà ce thème
    const alreadyOwned = player.ownedThemes && player.ownedThemes.some(t => t.type === type && t.path === path);
    if (alreadyOwned) {
      return res.status(400).json({ message: 'Thème déjà possédé' });
    }

    // Vérifier si le joueur a assez de pièces
    const currentBalance = player.soldePiece || 0;
    console.log(`💰 Solde actuel: ${currentBalance}, Prix: ${price}`);

    if (currentBalance < price) {
      return res.status(400).json({
        message: 'Pas assez de pièces',
        currentBalance,
        required: price
      });
    }

    // Déduire les pièces
    player.soldePiece = currentBalance - price;

    // Ajouter le thème possédé
    if (!player.ownedThemes) {
      player.ownedThemes = [];
    }
    player.ownedThemes.push({
      type,
      path,
      price,
      purchasedAt: new Date()
    });

    await player.save();

    console.log(`✅ Thème acheté! Nouveau solde: ${player.soldePiece}`);

    res.status(200).json({
      success: true,
      message: 'Thème acheté avec succès',
      newBalance: player.soldePiece,
      ownedThemes: player.ownedThemes
    });
  } catch (error) {
    console.error('Erreur lors de l\'achat du thème:', error);
    res.status(500).json({
      message: 'Erreur lors de l\'achat du thème',
      error: error.message
    });
  }
});

// Routes administratives (à implémenter plus tard)
router.get('/', verifyToken, isAdmin, (req, res) => {
  res.status(200).json({ message: 'Get all users route (admin only)' });
});

router.get('/:id', verifyToken, isAdmin, (req, res) => {
  res.status(200).json({ message: 'Get user by ID route (admin only)' });
});

// Route pour dépenser des pièces (indices, annulation, etc.)
router.post('/spend-coins', verifyToken, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant valide requis' });
    }

    // Vérifier que c'est un token de Player
    if (!req.user || !req.user.playerId || !req.user.gameId) {
      return res.status(400).json({ message: 'Token de jeu requis' });
    }

    console.log('🎮 Dépense de pièces - playerId:', req.user.playerId, 'amount:', amount, 'reason:', reason);

    // Obtenir la connexion à la base de données du jeu
    const connection = gameDatabaseService.getGameConnection(req.user.gameId);

    if (!connection) {
      return res.status(500).json({ message: 'Connexion à la base du jeu non disponible' });
    }

    const Player = connection.model('Player');

    // Récupérer le joueur
    const player = await Player.findById(req.user.playerId);

    if (!player) {
      return res.status(404).json({ message: 'Joueur non trouvé' });
    }

    // Vérifier si le joueur a assez de pièces
    const currentBalance = player.soldePiece || 0;

    if (currentBalance < amount) {
      return res.status(400).json({
        message: 'Pas assez de pièces',
        currentBalance,
        required: amount
      });
    }

    // Déduire les pièces
    player.soldePiece = currentBalance - amount;

    await player.save();

    console.log(`✅ Pièces dépensées! Nouveau solde: ${player.soldePiece}`);

    res.status(200).json({
      success: true,
      message: 'Pièces dépensées avec succès',
      newBalance: player.soldePiece
    });
  } catch (error) {
    console.error('Erreur lors de la dépense de pièces:', error);
    res.status(500).json({
      message: 'Erreur lors de la dépense de pièces',
      error: error.message
    });
  }
});

// Route pour dépenser de l'énergie (lancement d'une partie en entraînement)
router.post('/spend-energy', verifyToken, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant valide requis' });
    }

    // Vérifier que c'est un token de Player
    if (!req.user || !req.user.playerId || !req.user.gameId) {
      return res.status(400).json({ message: 'Token de jeu requis' });
    }

    console.log('🎮 Dépense d\'énergie - playerId:', req.user.playerId, 'amount:', amount, 'reason:', reason);

    // Obtenir la connexion à la base de données du jeu
    const connection = gameDatabaseService.getGameConnection(req.user.gameId);

    if (!connection) {
      return res.status(500).json({ message: 'Connexion à la base du jeu non disponible' });
    }

    const Player = connection.model('Player');

    // Récupérer le joueur
    const player = await Player.findById(req.user.playerId);

    if (!player) {
      return res.status(404).json({ message: 'Joueur non trouvé' });
    }

    // Vérifier si le joueur a assez d'énergie
    const currentBalance = player.soldeEnergie || 0;

    if (currentBalance < amount) {
      return res.status(400).json({
        message: 'Pas assez d\'énergie',
        currentBalance,
        required: amount
      });
    }

    // Déduire l'énergie
    player.soldeEnergie = currentBalance - amount;

    await player.save();

    console.log(`✅ Énergie dépensée! Nouveau solde: ${player.soldeEnergie}`);

    res.status(200).json({
      success: true,
      message: 'Énergie dépensée avec succès',
      newBalance: player.soldeEnergie
    });
  } catch (error) {
    console.error('Erreur lors de la dépense d\'énergie:', error);
    res.status(500).json({
      message: 'Erreur lors de la dépense d\'énergie',
      error: error.message
    });
  }
});

module.exports = router;