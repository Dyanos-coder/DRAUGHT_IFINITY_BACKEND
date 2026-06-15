/**
 * Script de test pour vérifier les soldes des joueurs dans la base de données
 */

const mongoose = require('mongoose');
const Game = require('./src/models/game.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sannicharbel:fzdLOWRUgFCHYqwl@cluster0.fccao1l.mongodb.net/arena?retryWrites=true&w=majority&appName=Cluster0';

async function checkPlayerBalances() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB\n');

    // Récupérer tous les jeux
    const games = await Game.find({});
    console.log(`📊 ${games.length} jeu(x) trouvé(s)\n`);

    for (const game of games) {
      console.log(`\n🎮 Jeu: ${game.name} (ID: ${game._id})`);
      console.log('─'.repeat(60));
      
      try {
        // Créer une connexion à la base de données du jeu
        const gameDbUri = `${MONGO_URI.split('/').slice(0, -1).join('/')}/game_${game._id}`;
        const gameConnection = await mongoose.createConnection(gameDbUri).asPromise();
        
        // Définir le schéma Player
        const playerSchema = new mongoose.Schema({
          inGameUsername: String,
          inGameEmail: String,
          soldePiece: Number,
          soldeEnergie: Number,
          level: Number,
          wins: Number,
          losses: Number
        }, { strict: false });

        const Player = gameConnection.model('Player', playerSchema);

        // Récupérer tous les joueurs
        const players = await Player.find({}).limit(10);
        
        if (players.length === 0) {
          console.log('  ⚠️ Aucun joueur trouvé dans ce jeu\n');
        } else {
          console.log(`  📋 ${players.length} joueur(s) (affichage max 10):\n`);
          
          players.forEach((player, index) => {
            const hasPieces = player.soldePiece !== undefined && player.soldePiece !== null;
            const hasEnergy = player.soldeEnergie !== undefined && player.soldeEnergie !== null;
            
            console.log(`  ${index + 1}. ${player.inGameUsername || 'Sans nom'}`);
            console.log(`     Email: ${player.inGameEmail || 'N/A'}`);
            console.log(`     Pièces: ${hasPieces ? player.soldePiece : '❌ MANQUANT'}`);
            console.log(`     Énergie: ${hasEnergy ? player.soldeEnergie : '❌ MANQUANT'}`);
            console.log(`     Level: ${player.level || 0} | Victoires: ${player.wins || 0} | Défaites: ${player.losses || 0}`);
            console.log('');
          });

          // Compter les joueurs avec des champs manquants
          const playersWithMissingFields = await Player.countDocuments({
            $or: [
              { soldePiece: { $exists: false } },
              { soldeEnergie: { $exists: false } }
            ]
          });

          if (playersWithMissingFields > 0) {
            console.log(`  ⚠️ ${playersWithMissingFields} joueur(s) sans soldePiece ou soldeEnergie`);
            console.log(`  💡 Exécutez: pnpm run fix:player-balances\n`);
          } else {
            console.log(`  ✅ Tous les joueurs ont leurs soldes correctement définis\n`);
          }
        }

        await gameConnection.close();

      } catch (gameError) {
        console.error(`  ❌ Erreur pour ${game.name}:`, gameError.message);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📝 RÉSUMÉ:');
    console.log('═'.repeat(60));
    console.log('Si des joueurs ont des champs manquants (❌ MANQUANT):');
    console.log('  1. Exécutez: pnpm run fix:player-balances');
    console.log('  2. Ou redémarrez le serveur: pnpm run dev');
    console.log('\nSi les valeurs sont à 0:');
    console.log('  C\'est normal pour un nouveau compte!');
    console.log('  Pour tester, modifiez manuellement dans MongoDB:');
    console.log('    db.players.updateOne(');
    console.log('      { inGameEmail: "votre@email.com" },');
    console.log('      { $set: { soldePiece: 1000, soldeEnergie: 50 } }');
    console.log('    )');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Déconnexion de MongoDB\n');
    process.exit(0);
  }
}

// Exécuter le script
checkPlayerBalances();
