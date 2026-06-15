const User = require('../models/user.model');
const Tournament = require('../models/tournament.model');
const Reward = require('../models/reward.model');

/**
 * Récupérer le classement des joueurs par gains
 */
exports.getEarningsLeaderboard = async (req, res) => {
  try {
    const users = await User.aggregate([
      // Calculer les gains totaux pour chaque utilisateur
      {
        $lookup: {
          from: 'rewards',
          localField: '_id',
          foreignField: 'userId',
          pipeline: [
            {
              $match: {
                type: { $in: ['win', 'validation', 'sponsorship'] },
                status: 'collected'
              }
            }
          ],
          as: 'rewards'
        }
      },
      // Calculer la somme des gains
      {
        $addFields: {
          totalEarnings: { $sum: '$rewards.amount' }
        }
      },
      // Trier par gains décroissants
      { $sort: { totalEarnings: -1 } },
      // Limiter à 100 joueurs
      { $limit: 100 },
      // Projeter seulement les champs nécessaires
      {
        $project: {
          username: 1,
          avatar: 1,
          totalEarnings: 1,
          sponsorship: 1,
          statistics: 1
        }
      }
    ]);

    // Ajouter le rang et formater la réponse
    const formattedUsers = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      earnings: user.totalEarnings,
      badges: [
        user.sponsorship?.level,
        user.statistics?.tournamentsWon > 0 ? `${user.statistics.tournamentsWon} Tournois gagnés` : null
      ].filter(Boolean)
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement par gains:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du classement' });
  }
};

/**
 * Récupérer le classement des joueurs par nombre de filleuls
 */
exports.getReferralsLeaderboard = async (req, res) => {
  try {
    const users = await User.aggregate([
      // Compter le nombre de filleuls actifs pour chaque utilisateur
      {
        $lookup: {
          from: 'users',
          localField: 'sponsorship.referrals',
          foreignField: '_id',
          as: 'activeReferrals'
        }
      },
      // Ajouter le nombre de filleuls comme champ
      {
        $addFields: {
          referralsCount: { $size: '$activeReferrals' }
        }
      },
      // Trier par nombre de filleuls décroissant
      { $sort: { referralsCount: -1 } },
      // Limiter à 100 joueurs
      { $limit: 100 },
      // Projeter seulement les champs nécessaires
      {
        $project: {
          username: 1,
          avatar: 1,
          referralsCount: 1,
          sponsorship: 1,
          statistics: 1
        }
      }
    ]);

    // Ajouter le rang et formater la réponse
    const formattedUsers = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      referrals: user.referralsCount,
      badges: [
        user.sponsorship?.level,
        user.statistics?.tournamentsWon > 0 ? `${user.statistics.tournamentsWon} Tournois gagnés` : null
      ].filter(Boolean)
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement par filleuls:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du classement' });
  }
};

/**
 * Récupérer le classement des joueurs par points de fidélité
 */
exports.getFidelityLeaderboard = async (req, res) => {
  try {
    const users = await User.find()
      .sort({ pointsDeFidelite: -1 })
      .limit(100)
      .select('username avatar pointsDeFidelite sponsorship statistics');

    const formattedUsers = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      points: user.pointsDeFidelite || 0,
      badges: [
        user.sponsorship?.level,
        user.statistics?.tournamentsWon > 0 ? `${user.statistics.tournamentsWon} Tournois gagnés` : null
      ].filter(Boolean)
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement par fidélité:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du classement' });
  }
};

/**
 * Récupérer le classement des joueurs par participation aux tournois
 */
exports.getParticipationLeaderboard = async (req, res) => {
  try {
    const users = await User.find()
      .sort({ 'statistics.tournamentsPlayed': -1 })
      .limit(100)
      .select('username avatar statistics sponsorship');

    const formattedUsers = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      tournaments: user.statistics?.tournamentsPlayed || 0,
      badges: [
        user.sponsorship?.level,
        user.statistics?.tournamentsWon > 0 ? `${user.statistics.tournamentsWon} Victoires` : null
      ].filter(Boolean)
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement par participation:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du classement' });
  }
};

/**
 * Récupérer le classement des joueurs par jeu (victoires)
 */
exports.getGameLeaderboard = async (req, res) => {
  try {
    const { gameId } = req.params;
    
    if (!gameId) {
      return res.status(400).json({ message: 'Le paramètre gameId est requis' });
    }

    // Récupérer les tournois de ce jeu
    const tournaments = await Tournament.find({ game: gameId })
      .select('players winner');

    // Compter les victoires par utilisateur
    const victoriesCount = {};
    tournaments.forEach(tournament => {
      if (tournament.winner) {
        const winnerId = tournament.winner.toString();
        victoriesCount[winnerId] = (victoriesCount[winnerId] || 0) + 1;
      }
    });

    // Récupérer les infos des utilisateurs
    const userIds = Object.keys(victoriesCount);
    const users = await User.find({ _id: { $in: userIds } })
      .select('username avatar sponsorship statistics');

    // Créer le classement
    const leaderboard = users.map(user => ({
      userId: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      victories: victoriesCount[user._id.toString()] || 0,
      badges: [
        user.sponsorship?.level,
        user.statistics?.tournamentsWon > 0 ? `${user.statistics.tournamentsWon} Tournois gagnés` : null
      ].filter(Boolean)
    }));

    // Trier par nombre de victoires
    leaderboard.sort((a, b) => b.victories - a.victories);
    
    // Limiter à 100 et ajouter les rangs
    const formattedUsers = leaderboard.slice(0, 100).map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: user.avatar,
      victories: user.victories,
      badges: user.badges
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération du classement par jeu:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du classement' });
  }
};

/**
 * Récupérer le rang de l'utilisateur connecté
 */
exports.getUserRanks = async (req, res) => {
  try {
    const userId = req.userId;

    // Obtenir le classement par gains
    const earningsRanking = await User.aggregate([
      // Calculer les gains totaux pour chaque utilisateur
      {
        $lookup: {
          from: 'rewards',
          localField: '_id',
          foreignField: 'userId',
          pipeline: [
            {
              $match: {
                type: { $in: ['win', 'validation', 'sponsorship'] },
                status: 'collected'
              }
            }
          ],
          as: 'rewards'
        }
      },
      // Calculer la somme des gains
      {
        $addFields: {
          totalEarnings: { $sum: '$rewards.amount' }
        }
      },
      // Trier par gains décroissants
      { $sort: { totalEarnings: -1 } },
      // Projeter seulement les champs nécessaires
      {
        $project: {
          _id: 1,
          totalEarnings: 1
        }
      }
    ]);

    // Obtenir le classement par filleuls
    const referralsRanking = await User.aggregate([
      // Compter le nombre de filleuls actifs pour chaque utilisateur
      {
        $lookup: {
          from: 'users',
          localField: 'sponsorship.referrals',
          foreignField: '_id',
          as: 'activeReferrals'
        }
      },
      // Ajouter le nombre de filleuls comme champ
      {
        $addFields: {
          referralsCount: { $size: '$activeReferrals' }
        }
      },
      // Trier par nombre de filleuls décroissant
      { $sort: { referralsCount: -1 } },
      // Projeter seulement les champs nécessaires
      {
        $project: {
          _id: 1,
          referralsCount: 1
        }
      }
    ]);

    // Trouver le rang de l'utilisateur dans chaque classement
    const earningsRank = earningsRanking.findIndex(user => user._id.toString() === userId) + 1;
    const referralsRank = referralsRanking.findIndex(user => user._id.toString() === userId) + 1;

    res.status(200).json({
      earningsRank: earningsRank || null,
      referralsRank: referralsRank || null,
      totalPlayers: earningsRanking.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rangs:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des rangs' });
  }
}; 