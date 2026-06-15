const mongoose = require('mongoose');
const config = require('./src/config/config');

// Schéma de base pour Game
const gameSchema = new mongoose.Schema({
  name: String,
  databaseName: String,
  _id: mongoose.Schema.Types.ObjectId
});

const Game = mongoose.model('Game', gameSchema);

async function checkDraughtInfinity() {
  try {
    console.log('🔍 Connexion à MongoDB...');
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connecté à MongoDB\n');

    // Chercher le jeu "draught infinity"
    console.log('🎮 Recherche du jeu "draught infinity"...');
    const game = await Game.findOne({ 
      name: { $regex: /draught infinity/i } 
    });

    if (!game) {
      console.log('❌ Jeu "draught infinity" non trouvé dans la collection games');
      console.log('\n📋 Liste de tous les jeux disponibles:');
      const allGames = await Game.find({}, 'name databaseName _id');
      allGames.forEach((g, idx) => {
        console.log(`  ${idx + 1}. ${g.name}`);
        console.log(`     - ID: ${g._id}`);
        console.log(`     - Database: ${g.databaseName || '❌ Non créée'}\n`);
      });
      process.exit(0);
    }

    console.log('✅ Jeu trouvé:');
    console.log(`   Nom: ${game.name}`);
    console.log(`   ID: ${game._id}`);
    console.log(`   Database: ${game.databaseName || '❌ Non créée'}`);

    // Vérifier que la base de données existe
    if (!game.databaseName) {
      console.log('\n⚠️  La base de données n\'a pas encore été créée pour ce jeu');
      console.log('💡 Solution: La base de données devrait être créée automatiquement lors de la première inscription d\'un joueur');
      process.exit(0);
    }

    // Calculer le nom de DB attendu
    const expectedDbName = `game_draught_infinity_${game._id.toString().substring(0, 8)}`;
    console.log(`\n🔍 Nom de DB attendu: ${expectedDbName}`);
    console.log(`📦 Nom de DB stocké: ${game.databaseName}`);
    
    if (game.databaseName !== expectedDbName) {
      console.log(`\n⚠️  ATTENTION: Le nom de la base de données ne correspond pas au format attendu!`);
    }

    // Se connecter à la base de données du jeu
    console.log(`\n🔗 Connexion à la base de données: ${game.databaseName}...`);
    
    const baseURI = config.mongoURI.split('?')[0].replace(/\/[^\/]*$/, '');
    const params = config.mongoURI.includes('?') ? '?' + config.mongoURI.split('?')[1] : '';
    const gameDbURI = `${baseURI}/${game.databaseName}${params}`;
    
    const gameConnection = await mongoose.createConnection(gameDbURI);
    console.log('✅ Connecté à la base de données du jeu\n');

    // Schéma Player
    const playerSchema = new mongoose.Schema({
      inGameUsername: String,
      inGameEmail: String,
      level: Number,
      wins: Number,
      losses: Number,
      soldePiece: Number,
      soldeEnergie: Number,
      registeredAt: Date
    }, { timestamps: true });

    const Player = gameConnection.model('Player', playerSchema);

    // Compter les joueurs
    const playerCount = await Player.countDocuments();
    console.log(`👥 Nombre total de joueurs: ${playerCount}`);

    if (playerCount > 0) {
      console.log('\n📋 Liste des joueurs (max 10):');
      const players = await Player.find({}).limit(10).sort({ registeredAt: -1 });
      
      players.forEach((player, idx) => {
        console.log(`\n  ${idx + 1}. ${player.inGameUsername || 'Sans nom'}`);
        console.log(`     Email: ${player.inGameEmail}`);
        console.log(`     Level: ${player.level || 0}`);
        console.log(`     Victoires: ${player.wins || 0} | Défaites: ${player.losses || 0}`);
        
        const hasPieces = player.soldePiece !== undefined && player.soldePiece !== null;
        const hasEnergy = player.soldeEnergie !== undefined && player.soldeEnergie !== null;
        
        console.log(`     💰 Pièces: ${hasPieces ? player.soldePiece : '❌ MANQUANT'}`);
        console.log(`     ⚡ Énergie: ${hasEnergy ? player.soldeEnergie : '❌ MANQUANT'}`);
        console.log(`     📅 Inscrit le: ${player.registeredAt ? new Date(player.registeredAt).toLocaleDateString('fr-FR') : 'N/A'}`);
      });

      // Compter les joueurs avec champs manquants
      const playersWithoutPieces = await Player.countDocuments({
        $or: [
          { soldePiece: { $exists: false } },
          { soldePiece: null }
        ]
      });

      const playersWithoutEnergy = await Player.countDocuments({
        $or: [
          { soldeEnergie: { $exists: false } },
          { soldeEnergie: null }
        ]
      });

      if (playersWithoutPieces > 0 || playersWithoutEnergy > 0) {
        console.log('\n\n⚠️  PROBLÈME DÉTECTÉ:');
        if (playersWithoutPieces > 0) {
          console.log(`   - ${playersWithoutPieces} joueur(s) n'ont pas le champ "soldePiece"`);
        }
        if (playersWithoutEnergy > 0) {
          console.log(`   - ${playersWithoutEnergy} joueur(s) n'ont pas le champ "soldeEnergie"`);
        }
        
        console.log('\n💡 SOLUTION:');
        console.log('   Exécutez le script de correction:');
        console.log('   pnpm run fix:player-balances');
      } else {
        console.log('\n\n✅ Tous les joueurs ont les champs soldePiece et soldeEnergie');
      }
    } else {
      console.log('\n⚠️  Aucun joueur trouvé dans cette base de données');
      console.log('💡 Cela pourrait expliquer pourquoi l\'app mobile affiche 0');
    }

    // Vérifier les collections disponibles
    console.log('\n\n📦 Collections disponibles dans cette base de données:');
    const collections = await gameConnection.db.listCollections().toArray();
    collections.forEach((col, idx) => {
      console.log(`   ${idx + 1}. ${col.name}`);
    });

    console.log('\n\n📊 RÉSUMÉ POUR L\'APP MOBILE:');
    console.log('=' .repeat(60));
    console.log(`🎮 Jeu: ${game.name}`);
    console.log(`🆔 Game ID: ${game._id}`);
    console.log(`📦 Base de données: ${game.databaseName}`);
    console.log(`👥 Nombre de joueurs: ${playerCount}`);
    console.log('=' .repeat(60));
    console.log('\n🔑 INFORMATIONS POUR LE CODE MOBILE:');
    console.log(`   - L'app doit s'authentifier avec gameName: "draught infinity"`);
    console.log(`   - Le backend crée/cherche des joueurs dans: ${game.databaseName}`);
    console.log(`   - Le gameId est: ${game._id}`);

    await gameConnection.close();
    await mongoose.connection.close();
    console.log('\n✅ Analyse terminée');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkDraughtInfinity();
