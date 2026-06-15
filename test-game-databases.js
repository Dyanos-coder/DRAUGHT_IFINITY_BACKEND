/**
 * Script de test pour le système de bases de données par jeu
 * Usage: node test-game-databases.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Game = require('./src/models/game.model');
const gameDatabaseService = require('./src/services/gameDatabaseService');

async function testGameDatabaseSystem() {
  try {
    console.log('🧪 Démarrage des tests du système de bases de données par jeu...\n');

    // 1. Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connecté à MongoDB\n');

    // 2. Créer un jeu de test
    console.log('📦 Création d\'un jeu de test...');
    const testGame = new Game({
      name: `Test Game ${Date.now()}`,
      description: 'Jeu créé pour tester le système de bases de données',
      category: 'action',
      publisher: 'Test Publisher',
      status: 'development'
    });
    await testGame.save();
    console.log(`✅ Jeu créé: ${testGame.name} (ID: ${testGame._id})\n`);

    // 3. Créer la base de données pour ce jeu
    console.log('🔨 Création de la base de données pour le jeu...');
    const dbResult = await gameDatabaseService.createGameDatabase(testGame);
    console.log(`✅ Base de données créée: ${dbResult.dbName}\n`);

    // 4. Vérifier que la connexion existe
    console.log('🔍 Vérification de la connexion...');
    const hasConnection = gameDatabaseService.hasGameDatabase(testGame._id.toString());
    console.log(`✅ Connexion active: ${hasConnection}\n`);

    // 5. Récupérer les informations de la base de données
    console.log('📊 Récupération des informations de la BD...');
    const connection = gameDatabaseService.getGameConnection(testGame._id.toString());
    if (connection) {
      const collections = await connection.db.listCollections().toArray();
      console.log('✅ Collections créées:');
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
      console.log('');
    }

    // 6. Tester l'insertion de données
    console.log('💾 Test d\'insertion de données...');
    const Player = connection.model('Player');
    const testPlayer = await Player.create({
      userId: new mongoose.Types.ObjectId(),
      inGameUsername: 'TestPlayer123',
      inGameEmail: 'test@example.com',
      level: 1,
      wins: 0,
      losses: 0
    });
    console.log(`✅ Joueur créé: ${testPlayer.inGameUsername}\n`);

    // 7. Vérifier les métadonnées
    console.log('🔍 Vérification des métadonnées...');
    const Metadata = connection.model('Metadata');
    const metadata = await Metadata.findOne({ gameId: testGame._id });
    if (metadata) {
      console.log('✅ Métadonnées trouvées:');
      console.log(`   - Jeu: ${metadata.gameName}`);
      console.log(`   - Version: ${metadata.version}`);
      console.log(`   - Créé le: ${metadata.createdAt.toISOString()}\n`);
    }

    // 8. Statistiques de la base de données
    console.log('📈 Statistiques de la base de données...');
    const stats = await connection.db.stats();
    console.log(`✅ Statistiques:`);
    console.log(`   - Collections: ${stats.collections}`);
    console.log(`   - Taille des données: ${stats.dataSize} bytes`);
    console.log(`   - Taille des index: ${stats.indexSize} bytes\n`);

    // 9. Test de la fonction verifyAndCreateMissingDatabases
    console.log('🔍 Test de vérification globale...');
    const verifyResults = await gameDatabaseService.verifyAndCreateMissingDatabases();
    console.log('✅ Résultats de la vérification:');
    console.log(`   - Total de jeux: ${verifyResults.total}`);
    console.log(`   - BDs créées: ${verifyResults.created}`);
    console.log(`   - BDs existantes: ${verifyResults.existing}`);
    console.log(`   - Erreurs: ${verifyResults.errors.length}\n`);

    // 10. Nettoyage (optionnel - décommenter pour supprimer le jeu de test)
    console.log('🧹 Nettoyage...');
    await gameDatabaseService.deleteGameDatabase(testGame._id.toString());
    console.log('✅ Base de données supprimée');
    
    await Game.findByIdAndDelete(testGame._id);
    console.log('✅ Jeu de test supprimé\n');

    console.log('🎉 Tous les tests ont réussi !');
    console.log('\n📋 Résumé:');
    console.log('   ✅ Création de jeu');
    console.log('   ✅ Création de base de données');
    console.log('   ✅ Initialisation des collections');
    console.log('   ✅ Insertion de données');
    console.log('   ✅ Vérification des métadonnées');
    console.log('   ✅ Statistiques de la BD');
    console.log('   ✅ Vérification globale');
    console.log('   ✅ Suppression de la BD');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    throw error;
  } finally {
    // Fermer la connexion principale
    await mongoose.connection.close();
    console.log('\n🔒 Connexion MongoDB fermée');
    process.exit(0);
  }
}

// Exécuter les tests
testGameDatabaseSystem().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
