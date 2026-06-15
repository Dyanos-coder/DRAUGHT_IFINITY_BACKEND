/**
 * Script pour vérifier et créer les bases de données pour tous les jeux existants
 * Usage: node verify-game-databases.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./src/config/config');
const gameDatabaseService = require('./src/services/gameDatabaseService');

async function verifyGameDatabases() {
  try {
    console.log('🔍 Vérification des bases de données des jeux...\n');

    // Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connecté à MongoDB\n');

    // Exécuter la vérification
    const results = await gameDatabaseService.verifyAndCreateMissingDatabases();

    // Afficher les résultats détaillés
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS DE LA VÉRIFICATION');
    console.log('='.repeat(60));
    console.log(`\n📈 Statistiques:`);
    console.log(`   Total de jeux: ${results.total}`);
    console.log(`   Bases créées: ${results.created}`);
    console.log(`   Bases existantes: ${results.existing}`);
    console.log(`   Erreurs: ${results.errors.length}`);

    if (results.details.length > 0) {
      console.log(`\n📋 Détails par jeu:`);
      results.details.forEach((detail, index) => {
        const statusIcon = detail.status === 'created' ? '🆕' : '✅';
        const statusText = detail.status === 'created' ? 'CRÉÉE' : 'EXISTANTE';
        console.log(`\n   ${index + 1}. ${statusIcon} ${detail.gameName}`);
        console.log(`      ID: ${detail.gameId}`);
        console.log(`      Status: ${statusText}`);
        console.log(`      Base de données: ${detail.dbName}`);
      });
    }

    if (results.errors.length > 0) {
      console.log(`\n⚠️  Erreurs rencontrées:`);
      results.errors.forEach((error, index) => {
        console.log(`\n   ${index + 1}. ❌ ${error.gameName}`);
        console.log(`      ID: ${error.gameId}`);
        console.log(`      Erreur: ${error.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (results.created > 0) {
      console.log(`\n✨ ${results.created} nouvelle(s) base(s) de données créée(s) avec succès !`);
    }
    
    if (results.errors.length === 0) {
      console.log('\n🎉 Toutes les bases de données sont opérationnelles !');
    } else {
      console.log(`\n⚠️  Attention: ${results.errors.length} erreur(s) détectée(s)`);
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    throw error;
  } finally {
    // Fermer la connexion
    await mongoose.connection.close();
    console.log('\n🔒 Connexion MongoDB fermée');
    process.exit(0);
  }
}

// Exécuter la vérification
verifyGameDatabases().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
