const mongoose = require('mongoose');
const config = require('./src/config/config');

// Schémas nécessaires
const gameSchema = new mongoose.Schema({
  name: String,
  databaseName: String
});

const Game = mongoose.model('Game', gameSchema);

async function diagnoseAppMobile() {
  try {
    console.log('🔍 DIAGNOSTIC COMPLET APP MOBILE\n');
    console.log('=' .repeat(70));
    
    // 1. Connexion MongoDB
    console.log('\n1️⃣  CONNEXION MONGODB');
    console.log('-'.repeat(70));
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connecté à MongoDB');

    // 2. Récupérer le jeu Draught Infinity
    console.log('\n2️⃣  JEU DRAUGHT INFINITY');
    console.log('-'.repeat(70));
    const game = await Game.findOne({ name: /draught infinity/i });
    
    if (!game) {
      console.log('❌ Jeu non trouvé!');
      process.exit(1);
    }

    console.log(`✅ Jeu: ${game.name}`);
    console.log(`   ID: ${game._id}`);
    console.log(`   Database: ${game.databaseName}`);

    // 3. Connexion à la DB du jeu
    console.log('\n3️⃣  BASE DE DONNÉES DU JEU');
    console.log('-'.repeat(70));
    
    const baseURI = config.mongoURI.split('?')[0].replace(/\/[^\/]*$/, '');
    const params = config.mongoURI.includes('?') ? '?' + config.mongoURI.split('?')[1] : '';
    const gameDbURI = `${baseURI}/${game.databaseName}${params}`;
    
    const gameConnection = await mongoose.createConnection(gameDbURI);
    console.log(`✅ Connecté à: ${game.databaseName}`);

    // 4. Vérifier les joueurs
    console.log('\n4️⃣  JOUEURS DANS LA BASE');
    console.log('-'.repeat(70));
    
    const playerSchema = new mongoose.Schema({
      inGameUsername: String,
      inGameEmail: String,
      inGamePassword: String,
      level: Number,
      wins: Number,
      losses: Number,
      soldePiece: Number,
      soldeEnergie: Number,
      registeredAt: Date
    });

    const Player = gameConnection.model('Player', playerSchema);
    const players = await Player.find({});
    
    console.log(`📊 Total: ${players.length} joueur(s)\n`);
    
    players.forEach((player, idx) => {
      console.log(`${idx + 1}. ${player.inGameUsername}`);
      console.log(`   📧 Email: ${player.inGameEmail}`);
      console.log(`   💰 Pièces: ${player.soldePiece !== undefined ? player.soldePiece : '❌ MANQUANT'}`);
      console.log(`   ⚡ Énergie: ${player.soldeEnergie !== undefined ? player.soldeEnergie : '❌ MANQUANT'}`);
      console.log(`   🏆 Level: ${player.level} | Victoires: ${player.wins} | Défaites: ${player.losses}`);
      console.log();
    });

    // 5. Simuler une réponse d'API
    console.log('\n5️⃣  SIMULATION RÉPONSE API /api/auth/me');
    console.log('-'.repeat(70));
    
    if (players.length > 0) {
      const player = players[0];
      const apiResponse = {
        player: {
          _id: player._id,
          inGameUsername: player.inGameUsername,
          inGameEmail: player.inGameEmail,
          level: player.level,
          experience: player.experience,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          soldePiece: player.soldePiece,
          soldeEnergie: player.soldeEnergie,
          registeredAt: player.registeredAt,
          lastActive: player.lastActive
        },
        game: {
          _id: game._id,
          name: game.name
        }
      };

      console.log('📦 Réponse API (JSON):');
      console.log(JSON.stringify(apiResponse, null, 2));

      console.log('\n🔍 Extraction des valeurs (comme dans Flutter):');
      console.log(`   response['player']['soldePiece'] = ${apiResponse.player.soldePiece}`);
      console.log(`   response['player']['soldeEnergie'] = ${apiResponse.player.soldeEnergie}`);
    }

    // 6. Vérifier la configuration réseau
    console.log('\n\n6️⃣  CONFIGURATION RÉSEAU');
    console.log('-'.repeat(70));
    console.log(`📡 Backend URL: ${config.backendUrl}`);
    console.log(`🔌 Port: ${config.port}`);
    console.log(`\n📱 Configuration app mobile attendue:`);
    console.log(`   - Pour émulateur Android: http://10.0.2.2:${config.port}`);
    console.log(`   - Pour émulateur iOS: http://localhost:${config.port}`);
    console.log(`   - Pour device physique: http://<IP_DE_VOTRE_PC>:${config.port}`);

    // 7. Checklist finale
    console.log('\n\n7️⃣  CHECKLIST DE DIAGNOSTIC');
    console.log('-'.repeat(70));
    
    const hasPieces = players.length > 0 && players[0].soldePiece !== undefined;
    const hasEnergy = players.length > 0 && players[0].soldeEnergie !== undefined;
    const nonZeroValues = players.length > 0 && players[0].soldePiece > 0;

    console.log(`${hasPieces ? '✅' : '❌'} Les joueurs ont le champ soldePiece`);
    console.log(`${hasEnergy ? '✅' : '❌'} Les joueurs ont le champ soldeEnergie`);
    console.log(`${nonZeroValues ? '✅' : '❌'} Les valeurs sont différentes de 0`);
    console.log(`${game.databaseName ? '✅' : '❌'} La base de données du jeu est créée`);

    console.log('\n\n8️⃣  ACTIONS À FAIRE');
    console.log('-'.repeat(70));
    console.log('\n📱 DANS L\'APP MOBILE FLUTTER:');
    console.log('   1. Vérifiez que le backend est démarré: pnpm run dev');
    console.log('   2. Vérifiez le baseUrl dans lib/core/api_service.dart');
    console.log(`      → Doit être: http://10.0.2.2:${config.port} (émulateur Android)`);
    console.log('   3. Rebuild l\'app: flutter clean && flutter run');
    console.log('   4. Regardez les logs Flutter (console) pendant le login');
    console.log('      → Cherchez les lignes commençant par 🔑 📦 👤 ✅');
    
    console.log('\n🔐 TEST MANUEL:');
    console.log('   1. Connectez-vous dans l\'app avec:');
    if (players.length > 0) {
      console.log(`      Email: ${players[0].inGameEmail}`);
      console.log(`      Password: <votre mot de passe>`);
    }
    console.log('   2. Observez les logs dans:');
    console.log('      - Console Flutter (côté mobile)');
    console.log('      - Terminal backend (côté serveur)');

    console.log('\n🐛 SI LE PROBLÈME PERSISTE:');
    console.log('   1. Vérifiez les logs Flutter pour voir ce qui est reçu');
    console.log('   2. Utilisez le script test-login-draught-infinity.js:');
    console.log('      → Modifiez le mot de passe (ligne 8)');
    console.log('      → Exécutez: node test-login-draught-infinity.js');
    console.log('      → Cela montrera exactement ce que le backend renvoie');

    await gameConnection.close();
    await mongoose.connection.close();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnostic terminé\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

diagnoseAppMobile();
