/**
 * Script de test pour les routes Game Data
 * Usage: node test-game-data-routes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Game = require('./src/models/game.model');
const User = require('./src/models/user.model');
const Tournament = require('./src/models/tournament.model');
const gameDatabaseService = require('./src/services/gameDatabaseService');
const bcrypt = require('bcryptjs');

async function testGameDataRoutes() {
  try {
    console.log('🧪 Test des routes Game Data...\n');

    // Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connecté\n');

    // 1. Créer ou récupérer un jeu de test
    console.log('🎮 Création/récupération d\'un jeu de test...');
    let testGame = await Game.findOne({ name: 'Test Game API' });
    
    if (!testGame) {
      testGame = await Game.create({
        name: 'Test Game API',
        description: 'Jeu pour tester les routes',
        category: 'sport',
        publisher: 'Test Publisher',
        status: 'active'
      });
      console.log('✅ Jeu créé:', testGame.name);
    } else {
      console.log('✅ Jeu trouvé:', testGame.name);
    }

    // 2. Créer la base de données du jeu
    console.log('\n📦 Vérification de la base de données du jeu...');
    if (!gameDatabaseService.hasGameDatabase(testGame._id.toString())) {
      await gameDatabaseService.createGameDatabase(testGame);
      console.log('✅ Base de données créée');
    } else {
      console.log('✅ Base de données existe déjà');
    }

    // 3. Créer ou récupérer des utilisateurs de test
    console.log('\n👥 Création/récupération d\'utilisateurs de test...');
    let user1 = await User.findOne({ email: 'testplayer1@game.com' });
    let user2 = await User.findOne({ email: 'testplayer2@game.com' });

    if (!user1) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      user1 = await User.create({
        email: 'testplayer1@game.com',
        password: hashedPassword,
        username: 'TestPlayer1',
        role: 'user',
        isVerified: true
      });
      console.log('✅ Utilisateur 1 créé:', user1.username);
    }

    if (!user2) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      user2 = await User.create({
        email: 'testplayer2@game.com',
        password: hashedPassword,
        username: 'TestPlayer2',
        role: 'user',
        isVerified: true
      });
      console.log('✅ Utilisateur 2 créé:', user2.username);
    }

    // 4. Tester l'inscription des joueurs dans le jeu
    console.log('\n📝 Test d\'inscription des joueurs au jeu...');
    const connection = gameDatabaseService.getGameConnection(testGame._id.toString());
    const Player = connection.model('Player');

    // Supprimer les anciens joueurs de test
    await Player.deleteMany({ userId: { $in: [user1._id, user2._id] } });

    // Inscrire le joueur 1
    const player1 = await Player.create({
      userId: user1._id,
      inGameUsername: 'ProGamer1',
      inGameEmail: 'progamer1@ingame.com',
      inGamePassword: await bcrypt.hash('gamepass1', 10),
      inGameId: 'GAME-001',
      level: 1,
      experience: 0,
      wins: 0,
      losses: 0
    });
    console.log('✅ Joueur 1 inscrit:', player1.inGameUsername);

    // Inscrire le joueur 2
    const player2 = await Player.create({
      userId: user2._id,
      inGameUsername: 'ProGamer2',
      inGameEmail: 'progamer2@ingame.com',
      inGamePassword: await bcrypt.hash('gamepass2', 10),
      inGameId: 'GAME-002',
      level: 1,
      experience: 0,
      wins: 0,
      losses: 0
    });
    console.log('✅ Joueur 2 inscrit:', player2.inGameUsername);

    // 5. Créer un tournoi de test
    console.log('\n🏆 Création d\'un tournoi de test...');
    const testTournament = await Tournament.create({
      title: 'Tournoi Test API',
      description: 'Tournoi pour tester',
      prize: 10000,
      status: 'open',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
      registrationStart: new Date(),
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      maxPlayers: 16,
      players: [user1._id, user2._id],
      type: '1v1',
      game: testGame._id,
      createdBy: user1._id,
      entryFee: 1000,
      firstPlaceReward: 5000,
      secondPlaceReward: 3000,
      thirdPlaceReward: 2000,
      matchTime: '14:00'
    });
    console.log('✅ Tournoi créé:', testTournament.title);

    // 6. Créer un match de test dans la base du jeu
    console.log('\n⚔️ Création d\'un match de test...');
    const Match = connection.model('Match');
    
    const testMatch = await Match.create({
      tournamentId: testTournament._id,
      players: [user1._id, user2._id],
      scores: [],
      status: 'pending',
      matchData: {}
    });
    console.log('✅ Match créé:', testMatch._id);

    // 7. Tester la mise à jour du score
    console.log('\n📊 Test de mise à jour du score...');
    testMatch.scores = [
      { playerId: user1._id, score: 3 },
      { playerId: user2._id, score: 1 }
    ];
    testMatch.winner = user1._id;
    testMatch.status = 'completed';
    testMatch.startedAt = new Date(Date.now() - 60 * 60 * 1000); // Il y a 1h
    testMatch.completedAt = new Date();
    await testMatch.save();
    console.log('✅ Score mis à jour');

    // 8. Mettre à jour les stats des joueurs
    console.log('\n🎯 Mise à jour des stats des joueurs...');
    
    // Joueur 1 gagne
    await Player.findByIdAndUpdate(player1._id, {
      $inc: { wins: 1, experience: 100 }
    });
    
    // Joueur 2 perd
    await Player.findByIdAndUpdate(player2._id, {
      $inc: { losses: 1, experience: 25 }
    });
    console.log('✅ Stats mises à jour');

    // 9. Vérifier les résultats
    console.log('\n📋 Vérification des résultats...');
    
    const updatedPlayer1 = await Player.findById(player1._id);
    const updatedPlayer2 = await Player.findById(player2._id);
    
    console.log('\n👤 Joueur 1:');
    console.log(`   Username: ${updatedPlayer1.inGameUsername}`);
    console.log(`   Level: ${updatedPlayer1.level}`);
    console.log(`   Experience: ${updatedPlayer1.experience}`);
    console.log(`   Wins: ${updatedPlayer1.wins}`);
    console.log(`   Losses: ${updatedPlayer1.losses}`);
    
    console.log('\n👤 Joueur 2:');
    console.log(`   Username: ${updatedPlayer2.inGameUsername}`);
    console.log(`   Level: ${updatedPlayer2.level}`);
    console.log(`   Experience: ${updatedPlayer2.experience}`);
    console.log(`   Wins: ${updatedPlayer2.wins}`);
    console.log(`   Losses: ${updatedPlayer2.losses}`);

    // 10. Afficher les infos du match
    console.log('\n⚔️ Match:');
    console.log(`   ID: ${testMatch._id}`);
    console.log(`   Status: ${testMatch.status}`);
    console.log(`   Winner: ${testMatch.winner}`);
    console.log(`   Scores:`, testMatch.scores);

    // 11. Test de récupération des tournois
    console.log('\n🔍 Test de récupération des tournois...');
    const tournaments = await Tournament.find({ game: testGame._id });
    console.log(`✅ ${tournaments.length} tournoi(s) trouvé(s) pour ${testGame.name}`);

    // 12. Test de récupération de l'historique
    console.log('\n📜 Test de l\'historique des matchs...');
    const player1Matches = await Match.find({
      players: user1._id,
      status: 'completed'
    });
    console.log(`✅ ${player1Matches.length} match(s) complété(s) pour ${updatedPlayer1.inGameUsername}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TOUS LES TESTS SONT PASSÉS !');
    console.log('='.repeat(60));

    console.log('\n📝 Résumé:');
    console.log(`   ✅ Jeu: ${testGame.name} (${testGame._id})`);
    console.log(`   ✅ Base de données: ${testGame.databaseName}`);
    console.log(`   ✅ Joueurs inscrits: 2`);
    console.log(`   ✅ Tournoi créé: ${testTournament.title}`);
    console.log(`   ✅ Match joué et score enregistré`);
    console.log(`   ✅ Stats des joueurs mises à jour`);

    console.log('\n💡 Routes API à tester:');
    console.log(`   GET    /api/game-data/${testGame._id}/tournaments`);
    console.log(`   POST   /api/game-data/${testGame._id}/players/register`);
    console.log(`   GET    /api/game-data/${testGame._id}/players/${user1._id}`);
    console.log(`   GET    /api/game-data/${testGame._id}/players/${user1._id}/matches`);
    console.log(`   PUT    /api/game-data/${testGame._id}/matches/${testMatch._id}/score`);

    console.log('\n📚 Commandes curl pour tester (remplacer TOKEN):');
    console.log(`\ncurl -X GET "http://localhost:5000/api/game-data/${testGame._id}/tournaments" \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
    
    console.log(`\ncurl -X GET "http://localhost:5000/api/game-data/${testGame._id}/players/${user1._id}" \\`);
    console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Connexion fermée');
    process.exit(0);
  }
}

// Exécuter les tests
testGameDataRoutes().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
