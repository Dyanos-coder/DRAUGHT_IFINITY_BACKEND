const mongoose = require('mongoose');
const gameDatabaseService = require('../services/gameDatabaseService');
const Game = require('../models/game.model');

/**
 * Créer un tournoi dans la base de données d'un jeu
 */
exports.createGameTournament = async (req, res) => {
  try {
    const { gameId } = req.params;
    const tournamentData = req.body;

    console.log('📥 Création tournoi - gameId:', gameId);
    console.log('📥 Données reçues:', JSON.stringify(tournamentData, null, 2));
    console.log('👤 User:', req.user);

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Jeu non trouvé' });
    }

    // Vérifier que le jeu a une base de données
    if (!game.databaseName) {
      return res.status(400).json({ 
        message: 'Ce jeu n\'a pas de base de données dédiée. Créez-en une d\'abord.' 
      });
    }

    console.log('✅ Jeu trouvé:', game.name, '- DB:', game.databaseName);

    // Obtenir la connexion à la base de données du jeu
    const connection = await gameDatabaseService.getGameConnection(gameId);

    // Définir le schéma du tournoi pour ce jeu
    const tournamentSchema = new mongoose.Schema({
      name: { type: String, required: true },
      description: { type: String, required: true },
      gameId: { type: mongoose.Schema.Types.ObjectId, required: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      registrationDeadline: { type: Date, required: true },
      maxParticipants: { type: Number, required: true, min: 2 },
      participants: [{
        playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
        username: String,
        registeredAt: { type: Date, default: Date.now },
        status: { 
          type: String, 
          enum: ['registered', 'confirmed', 'withdrawn'], 
          default: 'registered' 
        }
      }],
      entryFee: { type: Number, default: 0 },
      entryFeeInCoins: { type: Number, default: 0 }, // Pour Draught Infinity
      prizePool: { type: Number, default: 0 },
      // Récompenses classiques (argent réel)
      prizes: {
        first: { type: Number, default: 0 },
        second: { type: Number, default: 0 },
        third: { type: Number, default: 0 }
      },
      // Récompenses pour Draught Infinity (pièces et énergie)
      rewardTier: { 
        type: String, 
        enum: ['top3', 'top10', 'top50', 'top100'],
        default: 'top3'
      },
      coinRewards: {
        first: { type: Number, default: 0 },
        second: { type: Number, default: 0 },
        third: { type: Number, default: 0 },
        others: { type: Number, default: 0 } // Pour les autres gagnants (4-10, 4-50, 4-100)
      },
      energyRewards: {
        first: { type: Number, default: 0 },
        second: { type: Number, default: 0 },
        third: { type: Number, default: 0 },
        others: { type: Number, default: 0 }
      },
      format: { 
        type: String, 
        enum: ['single-elimination', 'double-elimination', 'round-robin'],
        required: true 
      },
      status: { 
        type: String, 
        enum: ['upcoming', 'registration-open', 'in-progress', 'completed', 'cancelled'],
        default: 'upcoming' 
      },
      rules: { type: String },
      bracket: { type: mongoose.Schema.Types.Mixed }, // Structure du bracket
      matches: [{
        round: Number,
        matchNumber: Number,
        player1Id: mongoose.Schema.Types.ObjectId,
        player2Id: mongoose.Schema.Types.ObjectId,
        winner: mongoose.Schema.Types.ObjectId,
        score: {
          player1: Number,
          player2: Number
        },
        scheduledAt: Date,
        playedAt: Date,
        status: { 
          type: String, 
          enum: ['pending', 'in-progress', 'completed', 'cancelled'],
          default: 'pending'
        }
      }],
      createdBy: { type: mongoose.Schema.Types.ObjectId, required: true }, // Admin qui a créé
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // Créer ou récupérer le modèle Tournament pour ce jeu
    let Tournament;
    try {
      Tournament = connection.model('Tournament');
    } catch (error) {
      Tournament = connection.model('Tournament', tournamentSchema);
    }

    // Créer le tournoi
    const tournament = new Tournament({
      ...tournamentData,
      gameId: game._id,
      createdBy: req.userId, // Utilise req.userId au lieu de req.user.userId
      participants: [],
      matches: []
    });

    await tournament.save();

    console.log(`✅ Tournoi créé dans la BD du jeu: ${game.name}`);

    res.status(201).json({
      message: 'Tournoi créé avec succès dans la base de données du jeu',
      tournament,
      game: {
        _id: game._id,
        name: game.name,
        databaseName: game.databaseName
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création du tournoi de jeu:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création du tournoi',
      error: error.message 
    });
  }
};

/**
 * Récupérer tous les tournois d'un jeu
 */
exports.getGameTournaments = async (req, res) => {
  try {
    const { gameId } = req.params;

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: 'Jeu non trouvé' });
    }

    if (!game.databaseName) {
      return res.status(200).json({ 
        message: 'Ce jeu n\'a pas de base de données dédiée',
        tournaments: []
      });
    }

    // Obtenir la connexion à la base de données du jeu
    const connection = await gameDatabaseService.getGameConnection(gameId);

    // Récupérer le modèle Tournament
    let Tournament;
    try {
      Tournament = connection.model('Tournament');
    } catch (error) {
      // Si le modèle n'existe pas, il n'y a pas de tournois
      return res.status(200).json({ 
        message: 'Aucun tournoi trouvé',
        tournaments: []
      });
    }

    const tournaments = await Tournament.find().sort({ createdAt: -1 });

    res.status(200).json({
      tournaments,
      game: {
        _id: game._id,
        name: game.name,
        databaseName: game.databaseName
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des tournois:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des tournois',
      error: error.message 
    });
  }
};

/**
 * Récupérer un tournoi spécifique d'un jeu
 */
exports.getGameTournament = async (req, res) => {
  try {
    const { gameId, tournamentId } = req.params;

    const game = await Game.findById(gameId);
    if (!game || !game.databaseName) {
      return res.status(404).json({ message: 'Jeu non trouvé ou sans base de données' });
    }

    const connection = await gameDatabaseService.getGameConnection(gameId);
    const Tournament = connection.model('Tournament');

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournoi non trouvé' });
    }

    res.status(200).json({ tournament });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du tournoi:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du tournoi',
      error: error.message 
    });
  }
};

/**
 * Mettre à jour un tournoi de jeu
 */
exports.updateGameTournament = async (req, res) => {
  try {
    const { gameId, tournamentId } = req.params;
    const updateData = req.body;

    const game = await Game.findById(gameId);
    if (!game || !game.databaseName) {
      return res.status(404).json({ message: 'Jeu non trouvé ou sans base de données' });
    }

    const connection = await gameDatabaseService.getGameConnection(gameId);
    const Tournament = connection.model('Tournament');

    updateData.updatedAt = new Date();

    const tournament = await Tournament.findByIdAndUpdate(
      tournamentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!tournament) {
      return res.status(404).json({ message: 'Tournoi non trouvé' });
    }

    console.log(`✅ Tournoi mis à jour dans la BD du jeu: ${game.name}`);

    res.status(200).json({
      message: 'Tournoi mis à jour avec succès',
      tournament
    });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du tournoi:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour du tournoi',
      error: error.message 
    });
  }
};

/**
 * Supprimer un tournoi de jeu
 */
exports.deleteGameTournament = async (req, res) => {
  try {
    const { gameId, tournamentId } = req.params;

    const game = await Game.findById(gameId);
    if (!game || !game.databaseName) {
      return res.status(404).json({ message: 'Jeu non trouvé ou sans base de données' });
    }

    const connection = await gameDatabaseService.getGameConnection(gameId);
    const Tournament = connection.model('Tournament');

    const tournament = await Tournament.findByIdAndDelete(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournoi non trouvé' });
    }

    console.log(`✅ Tournoi supprimé de la BD du jeu: ${game.name}`);

    res.status(200).json({
      message: 'Tournoi supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du tournoi:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression du tournoi',
      error: error.message 
    });
  }
};

/**
 * Inscrire un joueur à un tournoi
 */
exports.registerPlayerToTournament = async (req, res) => {
  try {
    const { gameId, tournamentId } = req.params;
    const { playerId } = req.body;

    const game = await Game.findById(gameId);
    if (!game || !game.databaseName) {
      return res.status(404).json({ message: 'Jeu non trouvé ou sans base de données' });
    }

    const connection = await gameDatabaseService.getGameConnection(gameId);
    const Tournament = connection.model('Tournament');
    const Player = connection.model('Player');

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournoi non trouvé' });
    }

    // Vérifier le statut
    if (tournament.status !== 'registration-open') {
      return res.status(400).json({ message: 'Les inscriptions ne sont pas ouvertes' });
    }

    // Vérifier la date limite
    if (new Date() > new Date(tournament.registrationDeadline)) {
      return res.status(400).json({ message: 'La date limite d\'inscription est dépassée' });
    }

    // Vérifier le nombre max de participants
    if (tournament.participants.length >= tournament.maxParticipants) {
      return res.status(400).json({ message: 'Le tournoi est complet' });
    }

    // Vérifier que le joueur existe
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Joueur non trouvé' });
    }

    // Vérifier que le joueur n'est pas déjà inscrit
    const alreadyRegistered = tournament.participants.some(
      p => p.playerId.toString() === playerId
    );
    if (alreadyRegistered) {
      return res.status(400).json({ message: 'Joueur déjà inscrit' });
    }

    // Ajouter le joueur
    tournament.participants.push({
      playerId: player._id,
      username: player.inGameUsername,
      registeredAt: new Date(),
      status: 'registered'
    });

    await tournament.save();

    res.status(200).json({
      message: 'Joueur inscrit avec succès',
      tournament
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'inscription:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'inscription',
      error: error.message 
    });
  }
};

/**
 * Retirer un joueur d'un tournoi
 */
exports.unregisterPlayerFromTournament = async (req, res) => {
  try {
    const { gameId, tournamentId, playerId } = req.params;

    const game = await Game.findById(gameId);
    if (!game || !game.databaseName) {
      return res.status(404).json({ message: 'Jeu non trouvé ou sans base de données' });
    }

    const connection = await gameDatabaseService.getGameConnection(gameId);
    const Tournament = connection.model('Tournament');

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournoi non trouvé' });
    }

    // Retirer le joueur
    tournament.participants = tournament.participants.filter(
      p => p.playerId.toString() !== playerId
    );

    await tournament.save();

    res.status(200).json({
      message: 'Joueur retiré avec succès',
      tournament
    });
  } catch (error) {
    console.error('❌ Erreur lors du retrait:', error);
    res.status(500).json({ 
      message: 'Erreur lors du retrait',
      error: error.message 
    });
  }
};
