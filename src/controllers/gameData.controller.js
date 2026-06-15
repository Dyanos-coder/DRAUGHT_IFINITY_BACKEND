const gameDatabaseService = require('../services/gameDatabaseService');
const Game = require('../models/game.model');
const Tournament = require('../models/tournament.model');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

/**
 * Récupérer la liste des tournois d'un jeu particulier
 * GET /api/game-data/:gameId/tournaments
 */
exports.getGameTournaments = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { status, limit = 20, page = 1 } = req.query;

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Construire la requête de filtrage
    let query = { game: gameId };
    
    // Filtrer par statut si fourni
    if (status && status !== 'all') {
      query.status = status;
    }

    // Calculer la pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les tournois de la base de données principale
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username email')
      .populate('players', 'username email avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Compter le total pour la pagination
    const total = await Tournament.countDocuments(query);

    // Enrichir les données avec les infos de la base du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    let enrichedTournaments = tournaments;
    
    if (connection) {
      const Player = connection.model('Player');
      const Match = connection.model('Match');

      enrichedTournaments = await Promise.all(tournaments.map(async (tournament) => {
        const tournamentObj = tournament.toObject();
        
        try {
          // Compter les matchs du tournoi dans la BD du jeu
          const matchCount = await Match.countDocuments({
            tournamentId: tournament._id
          });

          // Récupérer les stats des joueurs du tournoi
          const playerIds = tournament.players.map(p => p._id);
          const gamePlayers = await Player.find({
            userId: { $in: playerIds }
          }).select('userId level experience wins losses');

          // Créer un map des stats par userId
          const playerStatsMap = {};
          gamePlayers.forEach(gp => {
            playerStatsMap[gp.userId.toString()] = {
              level: gp.level,
              experience: gp.experience,
              wins: gp.wins,
              losses: gp.losses
            };
          });

          // Enrichir les joueurs avec leurs stats du jeu
          tournamentObj.players = tournamentObj.players.map(player => ({
            ...player,
            gameStats: playerStatsMap[player._id.toString()] || null
          }));

          tournamentObj.matchCount = matchCount;

        } catch (err) {
          console.error(`Erreur lors de l'enrichissement du tournoi ${tournament._id}:`, err);
        }

        return tournamentObj;
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        tournaments: enrichedTournaments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      },
      game: {
        _id: game._id,
        name: game.name,
        hasDatabase: gameDatabaseService.hasGameDatabase(gameId)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des tournois du jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tournois',
      error: error.message
    });
  }
};

/**
 * Inscrire un joueur dans la base de données d'un jeu
 * POST /api/game-data/:gameId/players/register
 */
exports.registerPlayerInGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { inGameUsername, inGameEmail, inGamePassword, inGameId } = req.body;
    const userId = req.userId; // ID de l'utilisateur authentifié

    // Validation des données
    if (!inGameUsername || !inGameEmail || !inGamePassword) {
      return res.status(400).json({
        success: false,
        message: 'Le pseudo, l\'email et le mot de passe in-game sont requis'
      });
    }

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Vérifier que la base de données du jeu existe
    if (!gameDatabaseService.hasGameDatabase(gameId)) {
      // Créer la base de données si elle n'existe pas
      console.log(`📦 Création de la base de données pour ${game.name}...`);
      await gameDatabaseService.createGameDatabase(game);
    }

    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de se connecter à la base de données du jeu'
      });
    }

    const Player = connection.model('Player');

    // Vérifier si le joueur est déjà inscrit
    const existingPlayer = await Player.findOne({ userId });
    if (existingPlayer) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà inscrit à ce jeu',
        player: existingPlayer
      });
    }

    // Vérifier si le pseudo ou l'email in-game est déjà utilisé
    const duplicateUsername = await Player.findOne({ 
      inGameUsername: { $regex: new RegExp(`^${inGameUsername}$`, 'i') }
    });
    if (duplicateUsername) {
      return res.status(400).json({
        success: false,
        message: 'Ce pseudo in-game est déjà utilisé'
      });
    }

    const duplicateEmail = await Player.findOne({ 
      inGameEmail: { $regex: new RegExp(`^${inGameEmail}$`, 'i') }
    });
    if (duplicateEmail) {
      return res.status(400).json({
        success: false,
        message: 'Cet email in-game est déjà utilisé'
      });
    }

    // Hasher le mot de passe in-game
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(inGamePassword, salt);

    // Créer le joueur dans la base du jeu
    const newPlayer = await Player.create({
      userId,
      inGameUsername,
      inGameEmail,
      inGamePassword: hashedPassword,
      inGameId: inGameId || null,
      level: 1,
      experience: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      soldePiece: 0,
      soldeEnergie: 0,
      statistics: {},
      achievements: [],
      registeredAt: new Date(),
      lastActive: new Date()
    });

    // Mettre à jour l'utilisateur dans la base principale
    const user = await User.findById(userId);
    if (user) {
      // Vérifier si le jeu n'est pas déjà dans registeredGames
      const alreadyRegistered = user.registeredGames.some(
        rg => rg.game.toString() === gameId
      );

      if (!alreadyRegistered) {
        user.registeredGames.push({
          game: gameId,
          inGameUsername,
          inGameEmail,
          registeredAt: new Date()
        });
        await user.save();
      }
    }

    // Retourner le joueur sans le mot de passe
    const playerResponse = newPlayer.toObject();
    delete playerResponse.inGamePassword;

    res.status(201).json({
      success: true,
      message: 'Inscription au jeu réussie',
      player: playerResponse,
      game: {
        _id: game._id,
        name: game.name
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription au jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription au jeu',
      error: error.message
    });
  }
};

/**
 * Mettre à jour le score d'un match dans la base de données d'un jeu
 * PUT /api/game-data/:gameId/matches/:matchId/score
 */
exports.updateMatchScore = async (req, res) => {
  try {
    const { gameId, matchId } = req.params;
    const { scores, winner, status, matchData } = req.body;
    const userId = req.userId;

    // Validation des données
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Les scores sont requis (tableau d\'objets avec playerId et score)'
      });
    }

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Vérifier que la base de données du jeu existe
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non trouvée'
      });
    }

    const Match = connection.model('Match');
    const Player = connection.model('Player');

    // Récupérer le match
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match non trouvé dans la base de données du jeu'
      });
    }

    // Vérifier que l'utilisateur est autorisé à mettre à jour ce match
    // (soit il est joueur du match, soit admin)
    const user = await User.findById(userId);
    const isAdmin = user && user.role === 'admin';
    const isPlayer = match.players.some(p => p.toString() === userId);

    if (!isAdmin && !isPlayer) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à mettre à jour ce match'
      });
    }

    // Valider que tous les joueurs dans scores existent dans le match
    const matchPlayerIds = match.players.map(p => p.toString());
    const invalidPlayers = scores.filter(s => !matchPlayerIds.includes(s.playerId.toString()));
    
    if (invalidPlayers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un ou plusieurs joueurs ne font pas partie de ce match'
      });
    }

    // Mettre à jour le match
    match.scores = scores.map(s => ({
      playerId: s.playerId,
      score: s.score
    }));

    if (status) {
      match.status = status;
    }

    if (winner) {
      match.winner = winner;
    }

    if (matchData) {
      match.matchData = { ...match.matchData, ...matchData };
    }

    // Si le match est terminé, mettre à jour les stats des joueurs
    if (status === 'completed' && winner) {
      try {
        for (const player of match.players) {
          const isWinner = player.toString() === winner.toString();
          const playerScore = scores.find(s => s.playerId.toString() === player.toString());
          
          const updateData = {
            lastActive: new Date(),
            $inc: {
              experience: isWinner ? 100 : 25
            }
          };

          if (isWinner) {
            updateData.$inc.wins = 1;
          } else {
            updateData.$inc.losses = 1;
          }

          const updatedPlayer = await Player.findOneAndUpdate(
            { userId: player },
            updateData,
            { new: true }
          );

          // Vérifier si le joueur monte de niveau
          if (updatedPlayer) {
            const newLevel = Math.floor(updatedPlayer.experience / 1000) + 1;
            if (newLevel > updatedPlayer.level) {
              updatedPlayer.level = newLevel;
              await updatedPlayer.save();
              console.log(`🎉 Joueur ${updatedPlayer.inGameUsername} est maintenant niveau ${newLevel}!`);
            }
          }
        }

        match.completedAt = new Date();
      } catch (err) {
        console.error('Erreur lors de la mise à jour des stats des joueurs:', err);
      }
    }

    if (status === 'in_progress' && !match.startedAt) {
      match.startedAt = new Date();
    }

    await match.save();

    // Mettre à jour le match dans la base principale si nécessaire
    if (match.tournamentId) {
      try {
        const mainMatch = await require('../models/match.model').findOne({
          _id: match.tournamentId,
          tournamentId: match.tournamentId
        });

        if (mainMatch) {
          mainMatch.scores = match.scores;
          if (winner) mainMatch.winner = winner;
          if (status) mainMatch.status = status;
          await mainMatch.save();
        }
      } catch (err) {
        console.error('Erreur lors de la mise à jour du match principal:', err);
      }
    }

    // Récupérer le match mis à jour avec les joueurs populés
    const updatedMatch = await Match.findById(matchId);
    const playersData = await Player.find({
      userId: { $in: match.players }
    }).select('userId inGameUsername level experience wins losses');

    const matchResponse = updatedMatch.toObject();
    matchResponse.playersDetails = playersData;

    res.status(200).json({
      success: true,
      message: 'Score du match mis à jour avec succès',
      match: matchResponse,
      game: {
        _id: game._id,
        name: game.name
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du score:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du score',
      error: error.message
    });
  }
};

/**
 * Obtenir les détails d'un joueur dans un jeu
 * GET /api/game-data/:gameId/players/:userId
 */
exports.getPlayerInGame = async (req, res) => {
  try {
    const { gameId, userId } = req.params;

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non trouvée'
      });
    }

    const Player = connection.model('Player');
    const player = await Player.findOne({ userId });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non inscrit à ce jeu'
      });
    }

    // Ne pas renvoyer le mot de passe
    const playerResponse = player.toObject();
    delete playerResponse.inGamePassword;

    // Calculer le taux de victoire
    const totalGames = player.wins + player.losses + player.draws;
    const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(2) : 0;

    playerResponse.stats = {
      totalGames,
      winRate: parseFloat(winRate)
    };

    res.status(200).json({
      success: true,
      player: playerResponse,
      game: {
        _id: game._id,
        name: game.name
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du joueur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du joueur',
      error: error.message
    });
  }
};

/**
 * Obtenir l'historique des matchs d'un joueur dans un jeu
 * GET /api/game-data/:gameId/players/:userId/matches
 */
exports.getPlayerMatchHistory = async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non trouvée'
      });
    }

    const Match = connection.model('Match');
    const Player = connection.model('Player');

    // Récupérer le joueur
    const player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non inscrit à ce jeu'
      });
    }

    // Calculer la pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les matchs du joueur
    const matches = await Match.find({
      players: userId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

    const total = await Match.countDocuments({
      players: userId,
      status: 'completed'
    });

    // Formater l'historique
    const history = matches.map(match => {
      const playerScore = match.scores.find(s => s.playerId.toString() === userId.toString());
      const isWinner = match.winner && match.winner.toString() === userId.toString();

      return {
        matchId: match._id,
        tournamentId: match.tournamentId,
        date: match.completedAt,
        won: isWinner,
        playerScore: playerScore?.score || 0,
        allScores: match.scores,
        status: match.status,
        matchData: match.matchData
      };
    });

    res.status(200).json({
      success: true,
      data: {
        matches: history,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      },
      player: {
        userId: player.userId,
        inGameUsername: player.inGameUsername,
        level: player.level
      },
      game: {
        _id: game._id,
        name: game.name
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
};

/**
 * Récupérer les tournois actifs depuis la base de données du jeu
 * GET /api/game-data/:gameId/active-tournaments
 */
exports.getActiveTournamentsFromGameDB = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 20 } = req.query;

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Vérifier que la base du jeu existe
    if (!gameDatabaseService.hasGameDatabase(gameId)) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non trouvée',
        data: []
      });
    }

    // Récupérer la connexion à la base du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de se connecter à la base du jeu',
        data: []
      });
    }

    // Créer le schéma Tournament s'il n'existe pas déjà
    const mongoose = require('mongoose');
    let GameTournament;
    try {
      GameTournament = connection.model('Tournament');
    } catch (e) {
      // Le modèle n'existe pas, le créer
      const tournamentSchema = new mongoose.Schema({
        name: { type: String, required: true },
        description: { type: String, default: '' },
        status: { 
          type: String, 
          enum: ['registration-open', 'upcoming', 'in-progress', 'completed', 'cancelled'],
          default: 'registration-open'
        },
        startDate: { type: Date },
        endDate: { type: Date },
        registrationDeadline: { type: Date },
        maxParticipants: { type: Number, default: 32 },
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
        entryFeeInCoins: { type: Number, default: 0 },
        coinRewards: {
          first: { type: Number, default: 0 },
          second: { type: Number, default: 0 },
          third: { type: Number, default: 0 }
        },
        energyRewards: {
          first: { type: Number, default: 0 },
          second: { type: Number, default: 0 },
          third: { type: Number, default: 0 }
        },
        format: { type: String, default: 'single-elimination' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }, { timestamps: true });

      GameTournament = connection.model('Tournament', tournamentSchema);
    }

    // Récupérer les tournois actifs
    let tournaments = await GameTournament.find({
      status: { $in: ['registration-open', 'upcoming', 'in-progress'] }
    })
      .sort({ startDate: 1, createdAt: -1 })
      .limit(parseInt(limit));

    // Si aucun tournoi actif, récupérer les plus récents (tous statuts confondus)
    if (tournaments.length === 0) {
      tournaments = await GameTournament.find({})
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    }

    res.status(200).json({
      success: true,
      data: tournaments,
      game: {
        _id: game._id,
        name: game.name
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des tournois actifs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tournois',
      error: error.message,
      data: []
    });
  }
};

/**
 * Rejoindre un tournoi (inscription avec déduction des pièces)
 * POST /api/game-data/:gameId/tournaments/:tournamentId/join
 */
exports.joinTournament = async (req, res) => {
  try {
    const { gameId, tournamentId } = req.params;

    console.log(`🎮 Tentative d'inscription au tournoi - Tournament: ${tournamentId}`);
    console.log(`👤 Mode token:`, req.user);

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    let playerId;

    // Déterminer le playerId selon le type de token
    if (req.user.playerId && req.user.gameId) {
      // Token de type Player - le joueur est déjà authentifié dans le jeu
      console.log(`🎮 Mode Player - playerId: ${req.user.playerId}`);
      playerId = req.user.playerId;
    } else {
      // Token de type User - utilisateur du site
      console.log(`🌐 Mode User - userId: ${req.userId}`);
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier que le joueur est lié à ce jeu
      const linkedGame = user.linkedGames?.find(lg => lg.gameId.toString() === gameId);
      if (!linkedGame) {
        return res.status(400).json({
          success: false,
          message: 'Vous devez d\'abord lier votre compte à ce jeu'
        });
      }

      playerId = linkedGame.playerId;
    }

    console.log(`👤 Player ID dans le jeu: ${playerId}`);

    // Récupérer la connexion à la base du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de se connecter à la base du jeu'
      });
    }

    // Récupérer le joueur dans la base du jeu
    let GamePlayer;
    try {
      GamePlayer = connection.model('Player');
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Modèle Player non trouvé dans la base du jeu'
      });
    }

    const gamePlayer = await GamePlayer.findById(playerId);
    if (!gamePlayer) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non trouvé dans la base du jeu'
      });
    }

    console.log(`💰 Solde actuel du joueur dans le jeu: ${gamePlayer.soldePiece || 0} pièces`);

    // Récupérer le modèle Tournament
    const mongoose = require('mongoose');
    let GameTournament;
    try {
      GameTournament = connection.model('Tournament');
    } catch (e) {
      return res.status(404).json({
        success: false,
        message: 'Aucun tournoi disponible pour ce jeu'
      });
    }

    // Récupérer le tournoi
    const tournament = await GameTournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournoi non trouvé'
      });
    }

    // Vérifier le statut du tournoi
    if (tournament.status !== 'registration-open') {
      return res.status(400).json({
        success: false,
        message: 'Les inscriptions ne sont pas ouvertes pour ce tournoi'
      });
    }

    // Vérifier la date limite d'inscription
    if (tournament.registrationDeadline && new Date() > new Date(tournament.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'La date limite d\'inscription est dépassée'
      });
    }

    // Vérifier le nombre max de participants
    if (tournament.participants && Array.isArray(tournament.participants)) {
      if (tournament.participants.length >= tournament.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Le tournoi est complet'
        });
      }

      // Vérifier que le joueur n'est pas déjà inscrit
      const alreadyRegistered = tournament.participants.some(
        p => p.toString() === playerId || (p.playerId && p.playerId.toString() === playerId)
      );
      if (alreadyRegistered) {
        return res.status(400).json({
          success: false,
          message: 'Vous êtes déjà inscrit à ce tournoi'
        });
      }
    }

    // Vérifier le solde de pièces DANS LA BD DU JEU
    const entryFee = tournament.entryFee || tournament.entryFeeInCoins || 0;
    console.log(`💰 Frais d'entrée: ${entryFee} pièces`);

    if (entryFee > 0) {
      if (!gamePlayer.soldePiece || gamePlayer.soldePiece < entryFee) {
        return res.status(400).json({
          success: false,
          message: `Solde insuffisant. Il vous faut ${entryFee} pièces pour participer.`,
          required: entryFee,
          current: gamePlayer.soldePiece || 0
        });
      }

      // Déduire les pièces DU JOUEUR DANS LA BD DU JEU
      gamePlayer.soldePiece -= entryFee;
      await gamePlayer.save();
      console.log(`✅ ${entryFee} pièces déduites du jeu. Nouveau solde: ${gamePlayer.soldePiece}`);
    }

    // Ajouter le joueur au tournoi
    if (!tournament.participants) {
      tournament.participants = [];
    }

    // Créer l'objet participant selon le schéma
    const participant = {
      playerId: playerId,
      username: gamePlayer.inGameUsername || 'Joueur',
      registeredAt: new Date(),
      status: 'registered'
    };

    tournament.participants.push(participant);

    await tournament.save();
    console.log(`✅ Joueur inscrit au tournoi: ${tournament.name}`);

    res.status(200).json({
      success: true,
      message: 'Inscription au tournoi réussie',
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        status: tournament.status,
        participants: tournament.participants.length
      },
      deducted: entryFee,
      newBalance: gamePlayer.soldePiece
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'inscription au tournoi:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription au tournoi',
      error: error.message
    });
  }
};

/**
 * Récupérer la progression des niveaux de dames du joueur
 * GET /api/game-data/:gameId/players/checkers/progress
 */
exports.getCheckersProgress = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const playerId = req.user?.playerId;

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Obtenir la connexion à la base de données du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non disponible'
      });
    }

    // Récupérer le joueur dans la base du jeu
    const Player = connection.model('Player');
    const player = playerId
      ? await Player.findById(playerId)
      : await Player.findOne({ userId });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non inscrit dans ce jeu'
      });
    }

    // Initialiser checkersProgress si absent
    if (!player.checkersProgress) {
      player.checkersProgress = {
        english: 0,
        russian: 0,
        brazilian: 0,
        turkish: 0,
        italian: 0
      };
      await player.save();
    }

    res.status(200).json({
      success: true,
      progress: player.checkersProgress
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression',
      error: error.message
    });
  }
};

/**
 * Mettre à jour la progression des niveaux de dames du joueur
 * PUT /api/game-data/:gameId/players/checkers/progress
 */
exports.updateCheckersProgress = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.userId;
    const playerId = req.user?.playerId;
    const { gameType, level } = req.body;

    // Validation
    const validGameTypes = ['english', 'russian', 'brazilian', 'turkish', 'italian'];
    if (!validGameTypes.includes(gameType)) {
      return res.status(400).json({
        success: false,
        message: 'Type de jeu invalide',
        validTypes: validGameTypes
      });
    }

    if (typeof level !== 'number' || level < 0 || level > 6) {
      return res.status(400).json({
        success: false,
        message: 'Niveau invalide (doit être entre 0 et 6)'
      });
    }

    // Vérifier que le jeu existe
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }

    // Obtenir la connexion à la base de données du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Base de données du jeu non disponible'
      });
    }

    // Récupérer le joueur dans la base du jeu
    const Player = connection.model('Player');
    const player = playerId
      ? await Player.findById(playerId)
      : await Player.findOne({ userId });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non inscrit dans ce jeu'
      });
    }

    // Initialiser checkersProgress si absent
    if (!player.checkersProgress) {
      player.checkersProgress = {
        english: 0,
        russian: 0,
        brazilian: 0,
        turkish: 0,
        italian: 0
      };
    }

    // Mettre à jour uniquement si le nouveau niveau est supérieur
    if (level > player.checkersProgress[gameType]) {
      player.checkersProgress[gameType] = level;
      player.lastActive = new Date();
      await player.save();

      console.log(`✅ Progression mise à jour pour ${player.inGameUsername}: ${gameType} niveau ${level}`);

      res.status(200).json({
        success: true,
        message: 'Progression mise à jour avec succès',
        progress: player.checkersProgress
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'Niveau déjà débloqué ou inférieur',
        progress: player.checkersProgress
      });
    }

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la progression',
      error: error.message
    });
  }
};
