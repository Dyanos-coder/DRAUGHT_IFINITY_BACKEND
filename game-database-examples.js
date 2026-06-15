/**
 * Exemples d'utilisation du service gameDatabaseService
 * Ce fichier montre comment utiliser les bases de données par jeu dans votre code
 */

const gameDatabaseService = require('./src/services/gameDatabaseService');
const mongoose = require('mongoose');

// ============================================================
// EXEMPLE 1 : Ajouter un joueur dans la base de données d'un jeu
// ============================================================
async function addPlayerToGame(gameId, userId, playerData) {
  try {
    // Obtenir la connexion du jeu
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée. Créez-la d\'abord.');
    }
    
    // Obtenir le modèle Player de cette base
    const Player = connection.model('Player');
    
    // Créer le joueur
    const player = await Player.create({
      userId: userId,
      inGameUsername: playerData.username,
      inGameEmail: playerData.email,
      inGameId: playerData.gameId,
      level: 1,
      experience: 0,
      wins: 0,
      losses: 0,
      draws: 0
    });
    
    console.log('✅ Joueur ajouté:', player.inGameUsername);
    return player;
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du joueur:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 2 : Enregistrer un match dans la base de données d'un jeu
// ============================================================
async function recordMatch(gameId, matchData) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Match = connection.model('Match');
    
    const match = await Match.create({
      tournamentId: matchData.tournamentId,
      players: matchData.players,
      scores: matchData.scores,
      winner: matchData.winner,
      status: 'completed',
      startedAt: matchData.startedAt,
      completedAt: new Date()
    });
    
    console.log('✅ Match enregistré:', match._id);
    return match;
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du match:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 3 : Récupérer les statistiques d'un joueur
// ============================================================
async function getPlayerStats(gameId, userId) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Player = connection.model('Player');
    const player = await Player.findOne({ userId });
    
    if (!player) {
      throw new Error('Joueur non trouvé dans ce jeu');
    }
    
    return {
      username: player.inGameUsername,
      level: player.level,
      experience: player.experience,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      winRate: player.wins / (player.wins + player.losses + player.draws) * 100,
      lastActive: player.lastActive
    };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des stats:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 4 : Mettre à jour les statistiques après un match
// ============================================================
async function updatePlayerStatsAfterMatch(gameId, playerId, won, draw = false) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Player = connection.model('Player');
    
    const updateData = {
      lastActive: new Date(),
      $inc: {
        experience: won ? 100 : (draw ? 50 : 25)
      }
    };
    
    if (won) {
      updateData.$inc.wins = 1;
    } else if (draw) {
      updateData.$inc.draws = 1;
    } else {
      updateData.$inc.losses = 1;
    }
    
    const player = await Player.findByIdAndUpdate(
      playerId,
      updateData,
      { new: true }
    );
    
    // Vérifier si le joueur monte de niveau
    const newLevel = Math.floor(player.experience / 1000) + 1;
    if (newLevel > player.level) {
      player.level = newLevel;
      await player.save();
      console.log(`🎉 ${player.inGameUsername} est maintenant niveau ${newLevel}!`);
    }
    
    console.log('✅ Statistiques mises à jour:', player.inGameUsername);
    return player;
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des stats:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 5 : Obtenir le classement des joueurs d'un jeu
// ============================================================
async function getLeaderboard(gameId, limit = 10) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Player = connection.model('Player');
    
    // Récupérer les meilleurs joueurs par nombre de victoires
    const topPlayers = await Player.find({})
      .sort({ wins: -1, experience: -1 })
      .limit(limit)
      .select('inGameUsername level wins losses draws experience');
    
    // Formater le classement
    const leaderboard = topPlayers.map((player, index) => ({
      rank: index + 1,
      username: player.inGameUsername,
      level: player.level,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      experience: player.experience,
      winRate: (player.wins / (player.wins + player.losses + player.draws) * 100).toFixed(2)
    }));
    
    console.log('✅ Classement récupéré:', leaderboard.length, 'joueurs');
    return leaderboard;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du classement:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 6 : Enregistrer des statistiques quotidiennes
// ============================================================
async function recordDailyStats(gameId, playerId) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Player = connection.model('Player');
    const Statistics = connection.model('Statistics');
    const Match = connection.model('Match');
    
    // Récupérer le joueur
    const player = await Player.findById(playerId);
    if (!player) {
      throw new Error('Joueur non trouvé');
    }
    
    // Compter les matchs du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const matchesToday = await Match.countDocuments({
      players: playerId,
      completedAt: { $gte: today }
    });
    
    // Créer l'entrée de statistiques
    await Statistics.create({
      playerId: playerId,
      date: today,
      statsType: 'daily',
      data: {
        matchesPlayed: matchesToday,
        level: player.level,
        experience: player.experience,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws
      }
    });
    
    console.log('✅ Statistiques quotidiennes enregistrées pour:', player.inGameUsername);
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des stats:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 7 : Obtenir l'historique des matchs d'un joueur
// ============================================================
async function getPlayerMatchHistory(gameId, playerId, limit = 20) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Match = connection.model('Match');
    
    const matches = await Match.find({
      players: playerId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .limit(limit)
    .populate('winner', 'inGameUsername');
    
    const history = matches.map(match => {
      const playerScore = match.scores.find(s => s.playerId.toString() === playerId.toString());
      const opponentScore = match.scores.find(s => s.playerId.toString() !== playerId.toString());
      
      return {
        matchId: match._id,
        date: match.completedAt,
        won: match.winner && match.winner._id.toString() === playerId.toString(),
        playerScore: playerScore?.score || 0,
        opponentScore: opponentScore?.score || 0,
        tournamentId: match.tournamentId
      };
    });
    
    console.log('✅ Historique récupéré:', history.length, 'matchs');
    return history;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de l\'historique:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 8 : Vérifier et créer la base de données si nécessaire
// ============================================================
async function ensureGameDatabase(game) {
  try {
    // Vérifier si la base de données existe
    const hasDatabase = gameDatabaseService.hasGameDatabase(game._id.toString());
    
    if (!hasDatabase) {
      console.log(`📦 Création de la base de données pour ${game.name}...`);
      await gameDatabaseService.createGameDatabase(game);
      console.log(`✅ Base de données créée pour ${game.name}`);
    } else {
      console.log(`✅ Base de données déjà existante pour ${game.name}`);
    }
    
    return gameDatabaseService.getGameConnection(game._id.toString());
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la BD:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 9 : Exporter toutes les données d'un jeu
// ============================================================
async function exportGameData(gameId) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Player = connection.model('Player');
    const Match = connection.model('Match');
    const Statistics = connection.model('Statistics');
    const Metadata = connection.model('Metadata');
    
    const exportData = {
      metadata: await Metadata.findOne({ gameId }),
      players: await Player.find({}),
      matches: await Match.find({}),
      statistics: await Statistics.find({}),
      exportDate: new Date(),
      summary: {
        totalPlayers: await Player.countDocuments(),
        totalMatches: await Match.countDocuments(),
        totalStatistics: await Statistics.countDocuments()
      }
    };
    
    console.log('✅ Données exportées:', exportData.summary);
    return exportData;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export:', error);
    throw error;
  }
}

// ============================================================
// EXEMPLE 10 : Nettoyer les anciennes données
// ============================================================
async function cleanOldData(gameId, daysToKeep = 90) {
  try {
    const connection = gameDatabaseService.getGameConnection(gameId);
    
    if (!connection) {
      throw new Error('Base de données du jeu non trouvée');
    }
    
    const Match = connection.model('Match');
    const Statistics = connection.model('Statistics');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Supprimer les vieux matchs
    const matchResult = await Match.deleteMany({
      completedAt: { $lt: cutoffDate }
    });
    
    // Supprimer les vieilles statistiques quotidiennes
    const statsResult = await Statistics.deleteMany({
      statsType: 'daily',
      date: { $lt: cutoffDate }
    });
    
    console.log(`✅ Nettoyage effectué:`);
    console.log(`   - ${matchResult.deletedCount} matchs supprimés`);
    console.log(`   - ${statsResult.deletedCount} stats supprimées`);
    
    return {
      matchesDeleted: matchResult.deletedCount,
      statisticsDeleted: statsResult.deletedCount
    };
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
}

// ============================================================
// Export des fonctions pour utilisation
// ============================================================
module.exports = {
  addPlayerToGame,
  recordMatch,
  getPlayerStats,
  updatePlayerStatsAfterMatch,
  getLeaderboard,
  recordDailyStats,
  getPlayerMatchHistory,
  ensureGameDatabase,
  exportGameData,
  cleanOldData
};

// ============================================================
// NOTES D'UTILISATION
// ============================================================
/*

IMPORTANT : Toujours vérifier que la base de données du jeu existe avant de l'utiliser !

Exemple d'utilisation dans un contrôleur :

const gameDbExamples = require('./game-database-examples');
const Game = require('./models/game.model');

// Dans votre route ou contrôleur
async function handlePlayerRegistration(req, res) {
  try {
    const { gameId, username, email } = req.body;
    const userId = req.userId;
    
    // 1. Récupérer le jeu
    const game = await Game.findById(gameId);
    
    // 2. Vérifier/créer la base de données
    await gameDbExamples.ensureGameDatabase(game);
    
    // 3. Ajouter le joueur
    const player = await gameDbExamples.addPlayerToGame(
      gameId,
      userId,
      { username, email }
    );
    
    res.json({ success: true, player });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

*/
