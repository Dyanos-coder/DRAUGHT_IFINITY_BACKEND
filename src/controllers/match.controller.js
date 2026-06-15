const Match = require('../models/match.model');
const Tournament = require('../models/tournament.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// Add other necessary services or models if needed, e.g., for bracket generation logic
// const bracketService = require('../services/bracketService');

/**
 * Get matches from today for the logged-in user for dispute purposes.
 * Only returns matches that are completed or in a state where results can be disputed.
 */
exports.getRecentMatchesForDispute = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Obtenir le début et la fin de la journée actuelle
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Trouver les matchs de l'utilisateur pour aujourd'hui
    const todayMatches = await Match.find({
      players: userId,
      status: { $in: ['completed', 'pending'] },
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
    .sort({ date: -1 })
    .populate('players', 'username _id avatar')
    .populate('tournamentId', 'title');

    console.log(`Recherche des matchs pour l'utilisateur ${userId} entre ${startOfDay} et ${endOfDay}`);
    console.log(`Nombre de matchs trouvés: ${todayMatches.length}`);

    const formattedMatches = todayMatches.map(match => {
      const opponent = match.players.find(p => p._id.toString() !== userId.toString());
      return {
        _id: match._id,
        opponent: opponent ? {
          _id: opponent._id,
          username: opponent.username,
          avatar: opponent.avatar
        } : {
          _id: 'unknown',
          username: 'Adversaire inconnu'
        },
        tournamentName: match.tournamentId ? match.tournamentId.title : 'Match non classé',
        playedAt: match.date.toISOString(),
        time: match.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        status: match.status,
        player1Score: match.player1Score,
        player2Score: match.player2Score,
        isUserPlayer1: match.players[0].toString() === userId.toString()
      };
    });

    res.status(200).json(formattedMatches);
  } catch (error) {
    console.error('Error fetching today\'s matches for dispute:', error);
    res.status(500).json({
      message: 'Impossible de récupérer les matchs du jour.',
      error: error.message
    });
  }
};

// Add other match controller functions here as needed
// e.g., getMatchDetails, reportScore, etc. 