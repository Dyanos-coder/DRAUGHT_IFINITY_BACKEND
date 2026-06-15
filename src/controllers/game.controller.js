const Game = require('../models/game.model');
const Tournament = require('../models/tournament.model');
const gameDatabaseService = require('../services/gameDatabaseService');

// Récupérer tous les jeux
exports.getAllGames = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    
    let query = {};
    
    // Filtre par statut
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filtre par catégorie
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Recherche par nom ou éditeur
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { publisher: { $regex: search, $options: 'i' } }
      ];
    }
    
    const games = await Game.find(query).sort({ createdAt: -1 });
    
    // Calculer les statistiques réelles pour chaque jeu
    const gamesWithStats = await Promise.all(games.map(async (game) => {
      const gameObj = game.toObject();
      
      try {
        // Compter le nombre total de tournois pour ce jeu
        const totalTournaments = await Tournament.countDocuments({ game: game._id });
        
        // Compter les tournois actifs (upcoming, open, in-progress)
        const activeTournaments = await Tournament.countDocuments({ 
          game: game._id,
          status: { $in: ['upcoming', 'open', 'in-progress'] }
        });
        
        // Récupérer tous les tournois de ce jeu pour compter les joueurs uniques
        const tournaments = await Tournament.find({ game: game._id }).populate('players');
        
        // Extraire tous les joueurs uniques
        const uniquePlayers = new Set();
        tournaments.forEach(tournament => {
          if (tournament.players && Array.isArray(tournament.players)) {
            tournament.players.forEach(player => {
              if (player && player._id) {
                uniquePlayers.add(player._id.toString());
              }
            });
          }
        });
        
        // Mettre à jour les analytics avec les vraies données
        gameObj.analytics = {
          ...gameObj.analytics,
          totalPlayers: uniquePlayers.size,
          activeTournaments: activeTournaments,
          totalTournaments: totalTournaments
        };
        
      } catch (err) {
        console.error(`Erreur lors du calcul des stats pour le jeu ${game._id}:`, err);
      }
      
      return gameObj;
    }));
    
    res.status(200).json({
      success: true,
      games: gamesWithStats
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des jeux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des jeux',
      error: error.message
    });
  }
};

// Récupérer un jeu par ID
exports.getGameById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    // Calculer les statistiques réelles pour ce jeu
    const gameObj = game.toObject();
    
    try {
      // Compter le nombre total de tournois pour ce jeu
      const totalTournaments = await Tournament.countDocuments({ game: game._id });
      
      // Compter les tournois actifs (upcoming, open, in-progress)
      const activeTournaments = await Tournament.countDocuments({ 
        game: game._id,
        status: { $in: ['upcoming', 'open', 'in-progress'] }
      });
      
      // Récupérer tous les tournois de ce jeu pour compter les joueurs uniques
      const tournaments = await Tournament.find({ game: game._id }).populate('players');
      
      // Extraire tous les joueurs uniques
      const uniquePlayers = new Set();
      tournaments.forEach(tournament => {
        if (tournament.players && Array.isArray(tournament.players)) {
          tournament.players.forEach(player => {
            if (player && player._id) {
              uniquePlayers.add(player._id.toString());
            }
          });
        }
      });
      
      // Mettre à jour les analytics avec les vraies données
      gameObj.analytics = {
        ...gameObj.analytics,
        totalPlayers: uniquePlayers.size,
        activeTournaments: activeTournaments,
        totalTournaments: totalTournaments
      };
      
    } catch (err) {
      console.error(`Erreur lors du calcul des stats pour le jeu ${game._id}:`, err);
    }
    
    res.status(200).json({
      success: true,
      game: gameObj
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du jeu',
      error: error.message
    });
  }
};

// Créer un nouveau jeu
exports.createGame = async (req, res) => {
  try {
    const {
      name,
      description,
      detailedDescription,
      category,
      status,
      publisher,
      officialWebsite,
      logo,
      coverImage,
      screenshots,
      trailerUrl,
      releaseDate,
      rules,
      supportedFormats,
      averageMatchDuration
    } = req.body;
    
    // Validation des champs requis
    if (!name || !description || !category || !publisher) {
      return res.status(400).json({
        success: false,
        message: 'Les champs nom, description, catégorie et éditeur sont requis'
      });
    }
    
    // Vérifier si un jeu avec le même nom existe déjà
    const existingGame = await Game.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingGame) {
      return res.status(400).json({
        success: false,
        message: 'Un jeu avec ce nom existe déjà'
      });
    }
    
    // Créer le nouveau jeu
    const newGame = new Game({
      name,
      description,
      detailedDescription,
      category,
      status: status || 'development',
      publisher,
      officialWebsite,
      logo,
      coverImage,
      screenshots: screenshots || [],
      trailerUrl,
      releaseDate: releaseDate || Date.now(),
      rules,
      supportedFormats: supportedFormats || ['1v1', 'Tournoi'],
      averageMatchDuration: averageMatchDuration || 15,
      analytics: {
        totalPlayers: 0,
        activeTournaments: 0,
        totalRevenue: 0,
        averageRating: 0
      }
    });
    
    await newGame.save();
    
    // Créer la base de données dédiée pour ce jeu
    try {
      await gameDatabaseService.createGameDatabase(newGame);
      console.log(`✅ Base de données créée pour le jeu: ${newGame.name}`);
    } catch (dbError) {
      console.error(`⚠️ Erreur lors de la création de la DB pour ${newGame.name}:`, dbError);
      // Ne pas bloquer la création du jeu si la DB échoue
    }
    
    res.status(201).json({
      success: true,
      message: 'Jeu créé avec succès',
      game: newGame
    });
  } catch (error) {
    console.error('Erreur lors de la création du jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du jeu',
      error: error.message
    });
  }
};

// Mettre à jour un jeu
exports.updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    // Vérifier si le nouveau nom existe déjà (si le nom est modifié)
    if (updateData.name && updateData.name !== game.name) {
      const existingGame = await Game.findOne({ 
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingGame) {
        return res.status(400).json({
          success: false,
          message: 'Un jeu avec ce nom existe déjà'
        });
      }
    }
    
    // Mettre à jour le jeu
    const updatedGame = await Game.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Jeu mis à jour avec succès',
      game: updatedGame
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du jeu',
      error: error.message
    });
  }
};

// Supprimer un jeu
exports.deleteGame = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    // Vérifier si le jeu est utilisé dans des tournois actifs
    // TODO: Ajouter cette vérification quand le modèle Tournament sera disponible
    
    await Game.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Jeu supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du jeu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du jeu',
      error: error.message
    });
  }
};

// Mettre à jour les statistiques d'un jeu
exports.updateGameAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalPlayers, activeTournaments, totalRevenue, averageRating } = req.body;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    // Mettre à jour les analytics
    const updates = {};
    if (totalPlayers !== undefined) updates['analytics.totalPlayers'] = totalPlayers;
    if (activeTournaments !== undefined) updates['analytics.activeTournaments'] = activeTournaments;
    if (totalRevenue !== undefined) updates['analytics.totalRevenue'] = totalRevenue;
    if (averageRating !== undefined) updates['analytics.averageRating'] = averageRating;
    
    const updatedGame = await Game.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Statistiques mises à jour avec succès',
      game: updatedGame
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des statistiques',
      error: error.message
    });
  }
};

// Vérifier et créer les bases de données manquantes pour tous les jeux
exports.verifyGamesDatabases = async (req, res) => {
  try {
    console.log('🔍 Démarrage de la vérification des bases de données des jeux...');
    
    const results = await gameDatabaseService.verifyAndCreateMissingDatabases();
    
    res.status(200).json({
      success: true,
      message: 'Vérification des bases de données terminée',
      results
    });
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des bases de données:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des bases de données',
      error: error.message
    });
  }
};

// Créer manuellement la base de données pour un jeu spécifique
exports.createGameDatabase = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    // Vérifier si la base de données existe déjà
    if (gameDatabaseService.hasGameDatabase(id)) {
      return res.status(400).json({
        success: false,
        message: 'Une base de données existe déjà pour ce jeu',
        dbName: game.databaseName
      });
    }
    
    const result = await gameDatabaseService.createGameDatabase(game);
    
    res.status(201).json({
      success: true,
      message: 'Base de données créée avec succès',
      dbName: result.dbName,
      game: await Game.findById(id)
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de la base de données:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la base de données',
      error: error.message
    });
  }
};

// Supprimer la base de données d'un jeu
exports.deleteGameDatabase = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    const result = await gameDatabaseService.deleteGameDatabase(id);
    
    res.status(200).json({
      success: true,
      message: 'Base de données supprimée avec succès',
      result
    });
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la base de données:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la base de données',
      error: error.message
    });
  }
};

// Obtenir les informations de la base de données d'un jeu
exports.getGameDatabaseInfo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const game = await Game.findById(id);
    
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Jeu non trouvé'
      });
    }
    
    const hasDatabase = gameDatabaseService.hasGameDatabase(id);
    const connection = gameDatabaseService.getGameConnection(id);
    
    let collections = [];
    let stats = null;
    
    if (connection) {
      // Récupérer les collections
      const collectionNames = await connection.db.listCollections().toArray();
      collections = collectionNames.map(col => col.name);
      
      // Récupérer les statistiques de la base de données
      const dbStats = await connection.db.stats();
      stats = {
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        indexSize: dbStats.indexSize,
        totalSize: dbStats.dataSize + dbStats.indexSize
      };
    }
    
    res.status(200).json({
      success: true,
      gameId: game._id,
      gameName: game.name,
      databaseName: game.databaseName,
      databaseCreatedAt: game.databaseCreatedAt,
      hasActiveConnection: hasDatabase,
      collections,
      stats
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des infos de la DB:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations',
      error: error.message
    });
  }
};
