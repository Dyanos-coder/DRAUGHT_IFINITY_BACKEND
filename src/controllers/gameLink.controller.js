const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Game = require('../models/game.model');
const config = require('../config/config');
const gameDatabaseService = require('../services/gameDatabaseService');
const bcrypt = require('bcryptjs');

/**
 * Lier un compte de jeu existant à un utilisateur du site
 * POST /api/link-game-account
 * Body: { gameId or gameName, inGameEmail, inGamePassword }
 * Headers: { Authorization: "Bearer <token>" }
 */
exports.linkGameAccount = async (req, res) => {
  try {
    console.log('🔗 Tentative de liaison de compte de jeu:', { 
      userId: req.user.id, 
      gameInput: req.body.gameId || req.body.gameName 
    });

    const { inGameEmail, inGamePassword } = req.body;
    const gameInput = req.body.gameId || req.body.gameName;

    // Validation
    if (!gameInput || !inGameEmail || !inGamePassword) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Veuillez fournir le jeu, l\'email et le mot de passe du compte de jeu'
      });
    }

    // Récupérer l'utilisateur connecté
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé'
      });
    }

    // Trouver le jeu
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let game = null;

    // Si c'est un ID MongoDB
    if (/^[0-9a-fA-F]{24}$/.test(gameInput)) {
      game = await Game.findById(gameInput);
    }

    // Sinon chercher par nom (insensible à la casse)
    if (!game) {
      const q = { name: { $regex: `^${escapeRegex(String(gameInput).trim())}$`, $options: 'i' } };
      game = await Game.findOne(q);
    }

    // Recherche permissive (slug ou inclusion)
    if (!game) {
      const permissiveQ = {
        $or: [
          { slug: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } },
          { name: { $regex: escapeRegex(String(gameInput).trim()), $options: 'i' } }
        ]
      };
      game = await Game.findOne(permissiveQ);
    }

    if (!game) {
      return res.status(404).json({
        success: false,
        error: 'GAME_NOT_FOUND',
        message: `Le jeu "${gameInput}" est introuvable`
      });
    }

    console.log(`✅ Jeu trouvé: ${game.name} (${game._id})`);

    // Vérifier si la BD du jeu existe
    if (!gameDatabaseService.hasGameDatabase(game._id.toString())) {
      return res.status(404).json({
        success: false,
        error: 'GAME_DB_NOT_FOUND',
        message: `La base de données du jeu "${game.name}" n'existe pas encore. Aucun joueur n'a créé de compte.`
      });
    }

    // Se connecter à la BD du jeu
    const connection = gameDatabaseService.getGameConnection(game._id.toString());
    if (!connection) {
      return res.status(500).json({
        success: false,
        error: 'CONNECTION_ERROR',
        message: 'Impossible de se connecter à la base de données du jeu'
      });
    }

    const Player = connection.model('Player');

    // Chercher le Player par email
    console.log(`🔍 Recherche du Player avec email: ${inGameEmail}`);
    const player = await Player.findOne({ inGameEmail });

    if (!player) {
      console.log(`❌ Aucun Player trouvé avec l'email ${inGameEmail}`);
      return res.status(404).json({
        success: false,
        error: 'PLAYER_NOT_FOUND',
        message: `Aucun compte trouvé dans ${game.name} avec cet email`,
        action: {
          title: 'Créer un compte dans le jeu',
          description: `Vous devez d'abord créer un compte dans l'application mobile de ${game.name}`,
          appDownloadLinks: {
            android: game.androidAppLink || 'https://play.google.com/store/apps',
            ios: game.iosAppLink || 'https://apps.apple.com/app'
          }
        }
      });
    }

    console.log(`✅ Player trouvé: ${player.inGameUsername} (${player._id})`);

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(inGamePassword, player.inGamePassword);
    if (!isPasswordValid) {
      console.log(`❌ Mot de passe incorrect pour le Player ${inGameEmail}`);
      return res.status(401).json({
        success: false,
        error: 'INVALID_PASSWORD',
        message: 'Le mot de passe du jeu est incorrect',
        hint: 'Utilisez le même mot de passe que celui de l\'application mobile'
      });
    }

    console.log(`✅ Mot de passe vérifié`);

    // Vérifier si ce Player est déjà lié à un autre utilisateur
    const existingLink = await User.findOne({
      'linkedGames.gameId': game._id,
      'linkedGames.playerId': player._id.toString(),
      _id: { $ne: user._id }  // Différent de l'utilisateur actuel
    });

    if (existingLink) {
      console.log(`⚠️ Ce Player est déjà lié à un autre utilisateur: ${existingLink.username}`);
      return res.status(409).json({
        success: false,
        error: 'ALREADY_LINKED',
        message: 'Ce compte du jeu est déjà lié à un autre utilisateur',
        linkedTo: {
          username: existingLink.username,
          linkedAt: existingLink.linkedGames.find(
            lg => lg.gameId.toString() === game._id.toString() && 
                  lg.playerId === player._id.toString()
          )?.linkedAt
        }
      });
    }

    // Vérifier si l'utilisateur a déjà lié ce jeu
    const alreadyLinkedByUser = user.linkedGames?.find(
      lg => lg.gameId.toString() === game._id.toString()
    );

    if (alreadyLinkedByUser) {
      console.log(`⚠️ L'utilisateur a déjà lié un compte pour ce jeu`);
      return res.status(409).json({
        success: false,
        error: 'GAME_ALREADY_LINKED',
        message: `Vous avez déjà lié un compte pour ${game.name}`,
        existingLink: {
          inGameUsername: alreadyLinkedByUser.inGameUsername,
          inGameEmail: alreadyLinkedByUser.inGameEmail,
          linkedAt: alreadyLinkedByUser.linkedAt
        }
      });
    }

    // Tout est bon ! On peut créer le lien
    const linkedGameData = {
      gameId: game._id,
      gameName: game.name,
      playerId: player._id.toString(),
      inGameUsername: player.inGameUsername,
      inGameEmail: player.inGameEmail,
      linkedAt: new Date(),
      cachedStats: {
        level: player.level || 1,
        wins: player.wins || 0,
        losses: player.losses || 0,
        draws: player.draws || 0,
        experience: player.experience || 0,
        lastSynced: new Date()
      }
    };

    user.linkedGames = user.linkedGames || [];
    user.linkedGames.push(linkedGameData);
    await user.save();

    // Optionnel: Mettre à jour le Player pour référencer l'utilisateur du site
    if (player.userId === null || player.userId === undefined) {
      player.userId = user._id;
      await player.save();
      console.log(`✅ Player.userId mis à jour avec ${user._id}`);
    }

    console.log(`✅ Compte du jeu lié avec succès!`);

    res.status(200).json({
      success: true,
      message: `Compte ${game.name} lié avec succès à votre profil`,
      data: {
        player: {
          _id: player._id,
          inGameUsername: player.inGameUsername,
          inGameEmail: player.inGameEmail,
          inGameId: player.inGameId,
          level: player.level,
          experience: player.experience,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws
        },
        game: {
          _id: game._id,
          name: game.name,
          logo: game.logo,
          category: game.category
        },
        linkedAt: linkedGameData.linkedAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la liaison du compte de jeu:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur serveur lors de la liaison du compte',
      details: error.message
    });
  }
};

/**
 * Récupérer tous les jeux liés à l'utilisateur connecté
 * GET /api/user/linked-games
 * Headers: { Authorization: "Bearer <token>" }
 */
exports.getLinkedGames = async (req, res) => {
  try {
    console.log('📋 Récupération des jeux liés pour userId:', req.user.id);

    const user = await User.findById(req.user.id)
      .populate('linkedGames.gameId')
      .select('linkedGames');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé'
      });
    }

    const linkedGames = user.linkedGames || [];

    console.log(`✅ ${linkedGames.length} jeu(x) lié(s) trouvé(s)`);

    res.status(200).json({
      success: true,
      count: linkedGames.length,
      data: linkedGames.map(lg => ({
        gameId: lg.gameId._id,
        gameName: lg.gameName,
        gameLogo: lg.gameId.logo,
        gameCategory: lg.gameId.category,
        playerId: lg.playerId,
        inGameUsername: lg.inGameUsername,
        inGameEmail: lg.inGameEmail,
        linkedAt: lg.linkedAt,
        stats: lg.cachedStats
      }))
    });

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des jeux liés:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur serveur',
      details: error.message
    });
  }
};

/**
 * Délier un compte de jeu
 * DELETE /api/unlink-game-account/:gameId
 * Headers: { Authorization: "Bearer <token>" }
 */
exports.unlinkGameAccount = async (req, res) => {
  try {
    const { gameId } = req.params;
    console.log('🔓 Tentative de déliaison du jeu:', { userId: req.user.id, gameId });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé'
      });
    }

    const initialLength = user.linkedGames?.length || 0;
    user.linkedGames = user.linkedGames?.filter(
      lg => lg.gameId.toString() !== gameId
    ) || [];

    if (user.linkedGames.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'LINK_NOT_FOUND',
        message: 'Aucun compte lié trouvé pour ce jeu'
      });
    }

    await user.save();

    console.log(`✅ Compte du jeu délié avec succès`);

    res.status(200).json({
      success: true,
      message: 'Compte du jeu délié avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la déliaison:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur serveur',
      details: error.message
    });
  }
};
