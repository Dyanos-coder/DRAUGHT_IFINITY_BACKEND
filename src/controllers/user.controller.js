const User = require('../models/user.model');
const gameDatabaseService = require('../services/gameDatabaseService');
const Match = require('../models/match.model');
const Tournament = require('../models/tournament.model');
const Reward = require('../models/reward.model');
const mongoose = require('mongoose');
const { createSponsorshipTicketsReward } = require('../services/rewardService');

// Fonction pour obtenir le fuseau horaire d'un pays
const getTimezoneForCountry = (countryName) => {
  // Mapping des pays africains et de leurs fuseaux horaires
  const countryTimezones = {
    // Afrique du Nord
    "Algérie": "GMT+1",
    "Égypte": "GMT+2",
    "Libye": "GMT+2",
    "Maroc": "GMT+1",
    "Soudan": "GMT+2",
    "Tunisie": "GMT+1",
    
    // Afrique de l'Ouest
    "Bénin": "GMT+1",
    "Burkina Faso": "GMT+0",
    "Cabo Verde": "GMT-1",
    "Côte d'Ivoire": "GMT+0",
    "Gambie": "GMT+0",
    "Ghana": "GMT+0",
    "Guinée": "GMT+0",
    "Guinée-Bissau": "GMT+0",
    "Liberia": "GMT+0",
    "Mali": "GMT+0",
    "Mauritanie": "GMT+0",
    "Niger": "GMT+1",
    "Nigeria": "GMT+1",
    "Sénégal": "GMT+0",
    "Sierra Leone": "GMT+0",
    "Togo": "GMT+0",
    
    // Afrique Centrale
    "Cameroun": "GMT+1",
    "République centrafricaine": "GMT+1",
    "Tchad": "GMT+1",
    "République du Congo": "GMT+1",
    "République démocratique du Congo": "GMT+1",
    "Guinée équatoriale": "GMT+1",
    "Gabon": "GMT+1",
    "São Tomé et Príncipe": "GMT+0",
    
    // Afrique de l'Est
    "Burundi": "GMT+2",
    "Comores": "GMT+3",
    "Djibouti": "GMT+3",
    "Érythrée": "GMT+3",
    "Éthiopie": "GMT+3",
    "Kenya": "GMT+3",
    "Madagascar": "GMT+3",
    "Malawi": "GMT+2",
    "Maurice": "GMT+4",
    "Mozambique": "GMT+2",
    "Rwanda": "GMT+2",
    "Seychelles": "GMT+4",
    "Somalie": "GMT+3",
    "Soudan du Sud": "GMT+2",
    "Tanzanie": "GMT+3",
    "Ouganda": "GMT+3",
    "Zambie": "GMT+2",
    "Zimbabwe": "GMT+2",
    
    // Afrique Australe
    "Angola": "GMT+1",
    "Botswana": "GMT+2",
    "Eswatini": "GMT+2",
    "Lesotho": "GMT+2",
    "Namibie": "GMT+2",
    "Afrique du Sud": "GMT+2"
  };
  
  return countryTimezones[countryName] || "GMT+0";
};

/**
 * Met à jour le niveau de parrainage d'un utilisateur
 */
async function updateSponsorshipLevel(user) {
  try {
    const oldLevel = user.sponsorship.level;
    const sponsorshipInfo = await user.getSponsorshipLevel();
    const newLevel = sponsorshipInfo.level;

    // Si le niveau a changé et que c'est une progression
    if (oldLevel !== newLevel && (!oldLevel || isLevelProgression(oldLevel, newLevel))) {
      // Mettre à jour le niveau
      user.sponsorship.level = newLevel;
      await user.save();

      // Créer une récompense de tickets si applicable
      if (sponsorshipInfo.rewardTickets > 0) {
        await createSponsorshipTicketsReward(user._id, newLevel);
      }

      console.log(`✅ Niveau de parrainage mis à jour pour ${user.username}: ${oldLevel || 'Aucun'} -> ${newLevel}`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du niveau de parrainage:', error);
  }
}

/**
 * Vérifie si le changement de niveau est une progression
 */
function isLevelProgression(oldLevel, newLevel) {
  const levels = [
    'Aucun',
    'Esclave ASC',
    'Paysan ASC',
    'Roturier ASC',
    'Noble ASC',
    'Chef de caste',
    'Gouverneur ASC',
    'Roi ASC',
    'Empereur ASC',
    'Emblème ASC'
  ];

  const oldIndex = levels.indexOf(oldLevel);
  const newIndex = levels.indexOf(newLevel);

  return newIndex > oldIndex;
}

/**
 * Récupérer le profil de l'utilisateur connecté
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.linkedUserId || req.userId;

    // Optimisation des champs populés et ajout d'index
    const user = await User.findById(userId)
      .select('-password -otpSecret')
      .populate({
        path: 'rewards',
        select: 'type amount description createdAt'
      })
      .populate({
        path: 'sponsorship.referredBy',
        select: 'username avatar'
      })
      .populate({
        path: 'sponsorship.referrals',
        select: 'username avatar statistics.totalWins statistics.totalLosses',
        
      })
      .populate({
        path: 'sponsorship.levelId',
        select: 'name rewardTickets earningsPercentage rechargePercentage'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Mettre à jour le niveau de parrainage de manière asynchrone
    user.updateSponsorshipLevel().catch(error => {
      console.error('Erreur lors de la mise à jour du niveau de parrainage:', error);
    });

    const userResponse = user.toObject();

    // En contexte jeu (token Player) : remplacer les infos par les données in-game
    if (req.user && req.user.gameId) {
      const gameId = req.user.gameId.toString();
      const lg = (userResponse.linkedGames || []).find(
        g => g.gameId && g.gameId.toString() === gameId
      );
      if (lg) {
        if (lg.inGameUsername) userResponse.username = lg.inGameUsername;
        if (lg.inGameEmail)    userResponse.email    = lg.inGameEmail;
        userResponse.avatar = lg.cachedAvatar || userResponse.avatar || '';
      }
    }

    res.status(200).json({
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
};

/**
 * Mettre à jour le profil de l'utilisateur connecté
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.linkedUserId || req.userId;
    const isGameCtx = !!(req.user && req.user.gameId && req.user.playerId);

    const {
      username,
      email,
      phoneNumber,
      timezone,
      profile,
      avatar,
      preferredCurrency
    } = req.body;

    console.log('Requête de mise à jour reçue avec les données:', {
      username, email, phoneNumber, timezone, profile, preferredCurrency,
      avatar: avatar ? (avatar.length > 50 ? avatar.substring(0, 50) + '...' : avatar) : null
    });

    // Vérifier l'unicité uniquement pour les champs qu'on touche vraiment dans la BD principale
    // En contexte jeu : ni username ni email ne modifient le User → pas de vérification
    if (!isGameCtx) {
      const fieldsToCheck = [
        ...(username ? [{ username }] : []),
        ...(email ? [{ email }] : [])
      ];
      if (fieldsToCheck.length > 0) {
        const existingUser = await User.findOne({
          $and: [{ _id: { $ne: userId } }, { $or: fieldsToCheck }]
        });
        if (existingUser) {
          return res.status(400).json({
            message: 'Un utilisateur avec cet email ou ce nom d\'utilisateur existe déjà'
          });
        }
      }
    }

    // Préparer les champs à mettre à jour sur le User principal
    const updateFields = {};

    // En contexte jeu : username → inGameUsername et email → inGameEmail (traités après)
    if (!isGameCtx && username) updateFields.username = username;
    if (!isGameCtx && email)    updateFields.email    = email;
    if (phoneNumber !== undefined) updateFields.phoneNumber = phoneNumber;
    if (preferredCurrency) updateFields.preferredCurrency = preferredCurrency;
    
    // Ajouter l'avatar seulement s'il est fourni et non vide
    if (avatar && avatar.trim() !== '') {
      updateFields.avatar = avatar;
      console.log('Avatar sera mis à jour avec:', avatar.substring(0, 50) + '...');
    } else {
      console.log('Avatar non mis à jour: valeur vide ou non fournie');
    }
    
    // Mettre à jour les champs du profil s'ils sont fournis
    if (profile) {
      updateFields['profile.bio'] = profile.bio !== undefined ? profile.bio : '';
      updateFields['profile.country'] = profile.country !== undefined ? profile.country : '';
      
      // Toujours dériver le fuseau horaire du pays
      if (profile.country) {
        updateFields.timezone = getTimezoneForCountry(profile.country);
      }
    }
    
    console.log('Champs à mettre à jour:', updateFields);
    
    // Mettre à jour l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    .select('-password -otpSecret')
    .populate('rewards')
    .populate('sponsorship.referredBy', 'username avatar')
    .populate('sponsorship.referrals', 'username avatar');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // En contexte jeu : mettre à jour l'inGameUsername dans linkedGames et dans la BD du jeu
    let returnedUsername = updatedUser.username;
    let returnedEmail    = updatedUser.email;
    let returnedAvatar   = updatedUser.avatar;
    if (isGameCtx && (username || email)) {
      const gameId = req.user.gameId.toString();
      const playerId = req.user.playerId.toString();
      try {
        // Mise à jour du cache dans linkedGames
        const cacheUpdate = {};
        if (username) cacheUpdate['linkedGames.$.inGameUsername'] = username;
        if (email)    cacheUpdate['linkedGames.$.inGameEmail']    = email;
        await User.updateOne(
          { _id: userId, 'linkedGames.gameId': req.user.gameId, 'linkedGames.playerId': playerId },
          { $set: cacheUpdate }
        );
        // Mise à jour dans la BD du jeu (Player)
        const conn = gameDatabaseService.getGameConnection(gameId);
        if (conn) {
          const Player = conn.model('Player');
          const playerUpdate = {};
          if (username) { playerUpdate.inGameUsername = username; playerUpdate.inGameId = username; }
          if (email)      playerUpdate.inGameEmail = email;
          await Player.findByIdAndUpdate(playerId, { $set: playerUpdate });
        }
        if (username) returnedUsername = username;
      } catch (e) {
        console.error('⚠️ Sync infos jeu:', e.message);
      }
    } else if (isGameCtx) {
      // Retourner l'inGameUsername existant si pas de mise à jour du username
      const lg = (updatedUser.linkedGames || []).find(
        g => g.gameId && g.gameId.toString() === req.user.gameId.toString()
      );
      if (lg) {
        returnedUsername = lg.inGameUsername || updatedUser.username;
        returnedEmail    = lg.inGameEmail    || updatedUser.email;
        returnedAvatar   = lg.cachedAvatar   || updatedUser.avatar || '';
      }
    }

    console.log('✅ Profil mis à jour avec succès:', {
      id: updatedUser._id,
      username: returnedUsername,
      avatar: returnedAvatar || '(vide)'
    });

    const responseData = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser._doc };
    responseData.username = returnedUsername;
    responseData.email    = returnedEmail;
    responseData.avatar   = returnedAvatar;
    res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Mettre à jour l'avatar de l'utilisateur
 */
exports.updateAvatar = async (req, res) => {
  try {
    const userId = req.linkedUserId || req.userId;
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ message: 'L\'URL de l\'avatar est requise' });
    }

    // Mettre à jour l'avatar dans la BD principale
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar } },
      { new: true }
    )
    .select('-password -otpSecret');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Si appelé depuis l'app de jeu (token Player), synchroniser aussi avec la BD du jeu
    if (req.user && req.user.gameId && req.user.playerId) {
      try {
        const gameId = req.user.gameId.toString();
        const playerId = req.user.playerId.toString();
        const conn = gameDatabaseService.getGameConnection(gameId);
        if (conn) {
          const Player = conn.model('Player');
          await Player.findByIdAndUpdate(playerId, { $set: { avatar } });
          // Mettre à jour le cache dans User.linkedGames
          await User.updateOne(
            { _id: userId, 'linkedGames.gameId': req.user.gameId, 'linkedGames.playerId': playerId },
            { $set: { 'linkedGames.$.cachedAvatar': avatar } }
          );
          console.log('✅ Avatar synchronisé dans la BD du jeu:', gameId);
        }
      } catch (gameErr) {
        console.error('⚠️ Sync avatar jeu échoué (non bloquant):', gameErr.message);
      }
    }

    console.log('✅ Avatar mis à jour avec succès:', {
      id: updatedUser._id,
      username: updatedUser.username
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de l\'avatar:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Mettre à jour le mot de passe de l'utilisateur connecté
 */
exports.updatePassword = async (req, res) => {
  try {
    const userId = req.linkedUserId || req.userId; // Fourni par le middleware verifyToken
    const { currentPassword, newPassword } = req.body;
    
    // Vérification des champs obligatoires
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Les mots de passe actuel et nouveau sont requis' });
    }
    
    // Vérification du format du nouveau mot de passe
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }
    
    if (!/\d/.test(newPassword)) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins un chiffre' });
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins un caractère spécial' });
    }
    
    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier si le mot de passe actuel est correct
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }
    
    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();
    
    console.log('✅ Mot de passe mis à jour avec succès pour:', { 
      id: user._id, 
      username: user.username 
    });
    
    res.status(200).json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du mot de passe:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Mettre à jour uniquement la devise préférée de l'utilisateur
 */
exports.updatePreferredCurrency = async (req, res) => {
  try {
    const userId = req.userId; // Fourni par le middleware verifyToken
    const { preferredCurrency } = req.body;
    
    console.log(`🔄 Tentative de mise à jour de la devise pour l'utilisateur ${userId}: ${preferredCurrency}`);
    
    // Vérifier que la devise est fournie
    if (!preferredCurrency) {
      return res.status(400).json({ message: 'La devise préférée est requise' });
    }
    
    // Vérifier que la devise est valide (doit correspondre aux valeurs enum dans le modèle)
    const validCurrencies = ['XOF', 'EUR', 'USD', 'MAD', 'NGN', 'GHS', 'ZAR'];
    if (!validCurrencies.includes(preferredCurrency)) {
      return res.status(400).json({ 
        message: 'Devise non valide. Les devises acceptées sont: ' + validCurrencies.join(', ') 
      });
    }
    
    // Mettre à jour uniquement la devise préférée
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { preferredCurrency } },
      { new: true }
    )
    .select('-password -otpSecret');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    console.log(`✅ Devise préférée mise à jour avec succès pour ${updatedUser.username}: ${preferredCurrency}`);
    
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la devise préférée:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Get overall statistics for the logged-in user.
 */
exports.getUserOverallStats = async (req, res) => {
  try {
    const userId = req.userId;
    console.log('Calcul des statistiques pour l\'utilisateur:', userId);
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const allUserMatches = await Match.find({ players: userId, status: 'completed' });
    const tournamentsWonCount = await Reward.countDocuments({ userId: userId, type: 'win' });

    // Calculer le nombre total de tournois joués
    console.log('Recherche des tournois pour l\'utilisateur...');
    const userTournaments = await Tournament.find({
      players: userId,
      status: { $in: ['complete', 'in-progress', 'open'] }
    }).select('_id title status');
    
    console.log('Tournois trouvés:', userTournaments.map(t => ({
      id: t._id,
      title: t.title,
      status: t.status
    })));
    
    const totalTournamentsPlayed = userTournaments.length;
    console.log('Nombre total de tournois joués:', totalTournamentsPlayed);

    const totalMatchesPlayed = allUserMatches.length;
    const totalWins = allUserMatches.filter(m => m.winner && m.winner.toString() === userId).length;
    const totalLosses = totalMatchesPlayed - totalWins;

    // Current month calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log('Calcul des tournois du mois en cours:', {
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString()
    });

    const matchesThisMonth = allUserMatches.filter(m => {
      const matchDate = new Date(m.date);
      return matchDate >= startOfMonth && matchDate <= endOfMonth;
    });

    // Calculer le nombre de tournois joués ce mois-ci
    const tournamentsThisMonth = await Tournament.find({
      players: userId,
      status: { $in: ['complete', 'in-progress', 'open'] },
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).select('_id title status');

    console.log('Tournois ce mois-ci:', tournamentsThisMonth.map(t => ({
      id: t._id,
      title: t.title,
      status: t.status
    })));

    const tournamentsPlayedThisMonth = tournamentsThisMonth.length;
    console.log('Nombre de tournois joués ce mois-ci:', tournamentsPlayedThisMonth);

    const winsThisMonth = matchesThisMonth.filter(m => m.winner && m.winner.toString() === userId).length;
    const lossesThisMonth = matchesThisMonth.length - winsThisMonth;
    const tournamentsWonThisMonth = await Reward.countDocuments({
      userId: userId,
      type: 'win',
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const stats = {
      totalWins: totalWins,
      totalLosses: totalLosses,
      totalMatchesPlayed: totalMatchesPlayed,
      ranking: user.ranking || null,
      tournamentsWon: tournamentsWonCount,
      totalTournamentsPlayed: totalTournamentsPlayed,
      currentMonthStats: {
        wins: winsThisMonth,
        losses: lossesThisMonth,
        lossesThisMonth: lossesThisMonth,
        matchesPlayed: matchesThisMonth.length,
        rankingChange: null,
        tournamentsWonThisMonth: tournamentsWonThisMonth,
        tournamentsPlayedThisMonth: tournamentsPlayedThisMonth
      },
    };

    console.log('Statistiques calculées:', stats);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching user overall stats:', error);
    res.status(500).json({ message: 'Failed to fetch overall stats.', error: error.message });
  }
};

/**
 * Get match history for the logged-in user.
 */
exports.getUserMatchHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    const matches = await Match.find({ players: userId, status: 'completed' })
      .sort({ date: -1 })
      .limit(limit)
      .populate('players', 'username')
      .populate('tournamentId', 'title');

    const matchHistory = matches.map(match => {
      const opponent = match.players.find(p => p._id.toString() !== userId);
      let result_status = 'draw';
      if (match.winner) {
        result_status = match.winner.toString() === userId ? 'win' : 'loss';
      }
      return {
        _id: match._id,
        opponentName: opponent ? opponent.username : 'Adversaire Inconnu',
        tournamentName: match.tournamentId ? match.tournamentId.title : 'Match Amical',
        result: result_status,
        score: `${match.player1Score || 0} - ${match.player2Score || 0}`,
        date: match.date.toISOString(),
      };
    });

    res.status(200).json(matchHistory);
  } catch (error) {
    console.error('Error fetching user match history:', error);
    res.status(500).json({ message: 'Failed to fetch match history.', error: error.message });
  }
};

/**
 * Get monthly performance data for the logged-in user.
 */
exports.getUserMonthlyPerformance = async (req, res) => {
  try {
    const userId = req.userId;
    const ObjectId = mongoose.Types.ObjectId;
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const monthlyPerformance = [];
    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth(); // 0-11
      const monthName = monthNames[monthIndex];

      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999); // Last day of the month

      const performance = await Match.aggregate([
        {
          $match: {
            players: new ObjectId(userId),
            status: 'completed',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null, // Group all matched documents together
            matchesPlayed: { $sum: 1 },
            wins: {
              $sum: {
                $cond: [{ $eq: ["$winner", new ObjectId(userId)] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            matchesPlayed: "$matchesPlayed",
            wins: "$wins"
          }
        }
      ]);

      if (performance.length > 0) {
        monthlyPerformance.unshift({
          month: monthName,
          year: year,
          matchesPlayed: performance[0].matchesPlayed,
          wins: performance[0].wins
        });
      } else {
        monthlyPerformance.unshift({
          month: monthName,
          year: year,
          matchesPlayed: 0,
          wins: 0
        });
      }
    }

    res.status(200).json(monthlyPerformance);
  } catch (error) {
    console.error('Error fetching user monthly performance:', error);
    res.status(500).json({ message: 'Failed to fetch monthly performance.', error: error.message });
  }
}; 