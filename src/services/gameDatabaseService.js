const mongoose = require('mongoose');
const config = require('../config/config');
const Game = require('../models/game.model');

/**
 * Service pour gérer les bases de données dédiées par jeu
 */
class GameDatabaseService {
  constructor() {
    this.gameConnections = new Map(); // Map pour stocker les connexions par jeu
  }

  /**
   * Générer le nom de la base de données pour un jeu
   * @param {string} gameName - Nom du jeu
   * @param {string} gameId - ID du jeu
   * @returns {string} Nom de la base de données
   */
  generateDatabaseName(gameName, gameId) {
    // Nettoyer le nom du jeu pour créer un nom de DB valide
    const cleanName = gameName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_') // Remplacer les caractères spéciaux par _
      .replace(/_+/g, '_') // Remplacer les _ multiples par un seul
      .substring(0, 50); // Limiter la longueur
    
    return `game_${cleanName}_${gameId.toString().substring(0, 8)}`;
  }

  /**
   * Obtenir l'URI MongoDB pour une base de données de jeu
   * @param {string} dbName - Nom de la base de données
   * @returns {string} URI MongoDB
   */
  getDatabaseURI(dbName) {
    // Extraire l'URI de base sans le nom de la base de données
    const baseURI = config.mongoURI.split('?')[0];
    const params = config.mongoURI.includes('?') ? '?' + config.mongoURI.split('?')[1] : '';
    
    // Si l'URI contient déjà un nom de base de données, le remplacer
    const uriWithoutDb = baseURI.replace(/\/[^\/]*$/, '');
    
    return `${uriWithoutDb}/${dbName}${params}`;
  }

  /**
   * Créer une base de données pour un jeu
   * @param {Object} game - Objet jeu avec _id et name
   * @returns {Promise<Object>} Résultat de la création
   */
  async createGameDatabase(game) {
    try {
      const dbName = this.generateDatabaseName(game.name, game._id);
      const dbURI = this.getDatabaseURI(dbName);

      console.log(`📦 Création de la base de données pour le jeu: ${game.name}`);
      console.log(`📦 Nom de la DB: ${dbName}`);

      // Vérifier si une connexion existe déjà
      if (this.gameConnections.has(game._id.toString())) {
        console.log(`✅ Connexion existante pour ${game.name}`);
        return {
          success: true,
          message: 'Base de données déjà existante',
          dbName,
          connection: this.gameConnections.get(game._id.toString())
        };
      }

      // Créer une nouvelle connexion
      const connection = await mongoose.createConnection(dbURI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
      });

      // Attendre que la connexion soit établie
      await new Promise((resolve, reject) => {
        connection.once('open', resolve);
        connection.once('error', reject);
      });

      console.log(`✅ Connexion établie pour ${dbName}`);

      // Stocker la connexion
      this.gameConnections.set(game._id.toString(), connection);

      // Créer les collections de base pour ce jeu
      await this.initializeGameCollections(connection, game);

      // Mettre à jour le jeu avec le nom de la base de données
      await Game.findByIdAndUpdate(game._id, {
        $set: { 
          databaseName: dbName,
          databaseCreatedAt: new Date()
        }
      });

      console.log(`✅ Base de données créée avec succès pour ${game.name}`);

      return {
        success: true,
        message: 'Base de données créée avec succès',
        dbName,
        connection
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la création de la DB pour ${game.name}:`, error);
      throw error;
    }
  }

  /**
   * Initialiser les collections de base pour un jeu
   * @param {mongoose.Connection} connection - Connexion MongoDB
   * @param {Object} game - Objet jeu
   */
  async initializeGameCollections(connection, game) {
    try {
      console.log(`📋 Initialisation des collections pour ${game.name}...`);

      // Créer un schéma pour les joueurs du jeu
      const playerSchema = new mongoose.Schema({
        // userId is optional for game-only accounts created from mobile auth flow.
        userId: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'User', default: null },
        inGameUsername: { type: String, required: true },
        inGameEmail: { type: String, required: true },
        inGamePassword: { type: String, required: true }, // Mot de passe in-game hashé
        inGameId: { type: String },
        level: { type: Number, default: 1 },
        experience: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        soldeEnergie: { type: Number, default: 0 }, // Solde d'énergie du joueur
        soldePiece: { type: Number, default: 0 }, // Solde de pièces du joueur
        statistics: { type: mongoose.Schema.Types.Mixed, default: {} },
        achievements: [{ type: String }],
        // Progression des niveaux de dames (pour le jeu Dames)
        checkersProgress: {
          english: { type: Number, default: 0, min: 0, max: 6 },
          russian: { type: Number, default: 0, min: 0, max: 6 },
          brazilian: { type: Number, default: 0, min: 0, max: 6 },
          turkish: { type: Number, default: 0, min: 0, max: 6 },
          italian: { type: Number, default: 0, min: 0, max: 6 }
        },
        registeredAt: { type: Date, default: Date.now },
        lastActive: { type: Date, default: Date.now }
      }, { timestamps: true });

      // Créer un schéma pour les matchs du jeu
      const matchSchema = new mongoose.Schema({
        tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
        players: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
        scores: [{ 
          playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
          score: { type: Number, required: true }
        }],
        winner: { type: mongoose.Schema.Types.ObjectId },
        matchData: { type: mongoose.Schema.Types.Mixed, default: {} },
        status: { 
          type: String, 
          enum: ['pending', 'in_progress', 'completed', 'cancelled', 'disputed'], 
          default: 'pending' 
        },
        startedAt: { type: Date },
        completedAt: { type: Date }
      }, { timestamps: true });

      // Créer un schéma pour les statistiques du jeu
      const statisticsSchema = new mongoose.Schema({
        playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
        date: { type: Date, default: Date.now },
        statsType: { type: String, required: true }, // daily, weekly, monthly, all-time
        data: { type: mongoose.Schema.Types.Mixed, default: {} }
      }, { timestamps: true });

      // Créer les modèles
      const Player = connection.model('Player', playerSchema);
      const Match = connection.model('Match', matchSchema);
      const Statistics = connection.model('Statistics', statisticsSchema);

      // Créer les index
      await Player.createIndexes();
      await Match.createIndexes();
      await Statistics.createIndexes();

      // Créer une collection de métadonnées
      const metadataSchema = new mongoose.Schema({
        gameId: { type: mongoose.Schema.Types.ObjectId, required: true },
        gameName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        version: { type: String, default: '1.0.0' },
        lastMigration: { type: Date },
        customSettings: { type: mongoose.Schema.Types.Mixed, default: {} }
      });

      const Metadata = connection.model('Metadata', metadataSchema);
      
      // Créer l'entrée de métadonnées
      await Metadata.create({
        gameId: game._id,
        gameName: game.name,
        version: '1.0.0',
        customSettings: {
          maxPlayersPerMatch: 2,
          tournamentFormats: ['single-elimination', 'double-elimination', 'round-robin']
        }
      });

      console.log(`✅ Collections initialisées pour ${game.name}`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'initialisation des collections:`, error);
      throw error;
    }
  }

  /**
   * Obtenir la connexion pour un jeu
   * @param {string} gameId - ID du jeu
   * @returns {mongoose.Connection|null} Connexion MongoDB
   */
  getGameConnection(gameId) {
    return this.gameConnections.get(gameId.toString()) || null;
  }

  /**
   * Vérifier si une base de données existe pour un jeu
   * @param {string} gameId - ID du jeu
   * @returns {boolean} True si la base existe
   */
  hasGameDatabase(gameId) {
    return this.gameConnections.has(gameId.toString());
  }

  /**
   * Fermer la connexion d'un jeu
   * @param {string} gameId - ID du jeu
   */
  async closeGameConnection(gameId) {
    const connection = this.gameConnections.get(gameId.toString());
    if (connection) {
      await connection.close();
      this.gameConnections.delete(gameId.toString());
      console.log(`🔒 Connexion fermée pour le jeu ${gameId}`);
    }
  }

  /**
   * Vérifier et créer les bases de données manquantes pour tous les jeux
   * @returns {Promise<Object>} Résultat de la vérification
   */
  async verifyAndCreateMissingDatabases() {
    try {
      console.log('🔍 Vérification des bases de données des jeux...');

      // Récupérer tous les jeux
      const games = await Game.find({});
      
      const results = {
        total: games.length,
        created: 0,
        existing: 0,
        errors: [],
        details: []
      };

      for (const game of games) {
        try {
          // Vérifier si la connexion est déjà établie
          if (this.hasGameDatabase(game._id.toString())) {
            console.log(`✅ Connexion déjà établie pour: ${game.name}`);
            results.existing++;
            results.details.push({
              gameId: game._id,
              gameName: game.name,
              status: 'existing',
              dbName: game.databaseName
            });
          } else if (game.databaseName) {
            // La DB existe mais la connexion n'est pas établie (après redémarrage)
            console.log(`🔄 Réouverture de la connexion pour: ${game.name}`);
            const result = await this.createGameDatabase(game);
            results.existing++;
            results.details.push({
              gameId: game._id,
              gameName: game.name,
              status: 'reconnected',
              dbName: result.dbName
            });
          } else {
            // Créer la base de données pour la première fois
            console.log(`🆕 Création de la base de données pour: ${game.name}`);
            const result = await this.createGameDatabase(game);
            results.created++;
            results.details.push({
              gameId: game._id,
              gameName: game.name,
              status: 'created',
              dbName: result.dbName
            });
          }
        } catch (error) {
          console.error(`❌ Erreur pour le jeu ${game.name}:`, error);
          results.errors.push({
            gameId: game._id,
            gameName: game.name,
            error: error.message
          });
        }
      }

      console.log(`\n📊 Résumé:`);
      console.log(`   Total de jeux: ${results.total}`);
      console.log(`   Bases créées: ${results.created}`);
      console.log(`   Bases existantes: ${results.existing}`);
      console.log(`   Erreurs: ${results.errors.length}`);

      return results;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des bases de données:', error);
      throw error;
    }
  }

  /**
   * Initialiser les soldes (soldeEnergie, soldePiece) pour tous les joueurs existants
   * Cette fonction est appelée au démarrage pour s'assurer que tous les joueurs ont ces champs
   * @returns {Promise<Object>} Résumé de l'initialisation
   */
  async initializePlayerBalances() {
    try {
      console.log('\n💰 Initialisation des soldes des joueurs...');
      
      const games = await Game.find({});
      const results = {
        total: games.length,
        updated: 0,
        skipped: 0,
        errors: [],
        details: []
      };

      for (const game of games) {
        try {
          // Vérifier si le jeu a une base de données
          if (!this.hasGameDatabase(game._id.toString())) {
            console.log(`⏭️ Pas de BD pour ${game.name}, ignoré`);
            results.skipped++;
            continue;
          }

          const connection = this.getGameConnection(game._id.toString());
          if (!connection) {
            console.log(`⚠️ Connexion impossible pour ${game.name}`);
            results.skipped++;
            continue;
          }

          const Player = connection.model('Player');

          // Trouver tous les joueurs qui n'ont pas soldeEnergie ou soldePiece
          const playersToUpdate = await Player.find({
            $or: [
              { soldeEnergie: { $exists: false } },
              { soldePiece: { $exists: false } }
            ]
          });

          if (playersToUpdate.length === 0) {
            console.log(`✅ Tous les joueurs de ${game.name} ont déjà leurs soldes`);
            results.details.push({
              gameId: game._id,
              gameName: game.name,
              playersUpdated: 0,
              status: 'already_initialized'
            });
            continue;
          }

          // Mettre à jour chaque joueur
          let updatedCount = 0;
          for (const player of playersToUpdate) {
            if (player.soldeEnergie === undefined) {
              player.soldeEnergie = 0;
            }
            if (player.soldePiece === undefined) {
              player.soldePiece = 0;
            }
            await player.save();
            updatedCount++;
          }

          console.log(`✅ ${updatedCount} joueur(s) mis à jour pour ${game.name}`);
          results.updated += updatedCount;
          results.details.push({
            gameId: game._id,
            gameName: game.name,
            playersUpdated: updatedCount,
            status: 'initialized'
          });

        } catch (error) {
          console.error(`❌ Erreur pour le jeu ${game.name}:`, error);
          results.errors.push({
            gameId: game._id,
            gameName: game.name,
            error: error.message
          });
        }
      }

      console.log(`\n📊 Résumé de l'initialisation des soldes:`);
      console.log(`   Total de jeux vérifiés: ${results.total}`);
      console.log(`   Joueurs mis à jour: ${results.updated}`);
      console.log(`   Jeux ignorés: ${results.skipped}`);
      console.log(`   Erreurs: ${results.errors.length}`);

      return results;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation des soldes:', error);
      throw error;
    }
  }

  /**
   * Supprimer la base de données d'un jeu
   * @param {string} gameId - ID du jeu
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deleteGameDatabase(gameId) {
    try {
      const game = await Game.findById(gameId);
      if (!game) {
        throw new Error('Jeu non trouvé');
      }

      const connection = this.getGameConnection(gameId);
      if (!connection) {
        console.log(`⚠️ Aucune connexion active pour le jeu ${game.name}`);
        return { success: true, message: 'Aucune base de données à supprimer' };
      }

      const dbName = game.databaseName || this.generateDatabaseName(game.name, gameId);

      console.log(`🗑️ Suppression de la base de données: ${dbName}`);

      // Supprimer la base de données
      await connection.dropDatabase();
      
      // Fermer la connexion
      await this.closeGameConnection(gameId);

      // Mettre à jour le jeu
      await Game.findByIdAndUpdate(gameId, {
        $unset: { databaseName: '', databaseCreatedAt: '' }
      });

      console.log(`✅ Base de données supprimée pour ${game.name}`);

      return {
        success: true,
        message: 'Base de données supprimée avec succès',
        dbName
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de la DB:`, error);
      throw error;
    }
  }
}

// Export une instance unique (Singleton)
module.exports = new GameDatabaseService();
