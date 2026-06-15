/**
 * Script pour corriger les soldes des joueurs (soldePiece et soldeEnergie)
 * Ce script met à jour tous les Players existants qui n'ont pas ces champs
 */

const mongoose = require('mongoose');
const Game = require('./src/models/game.model');

// Configuration de la connexion MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sannicharbel:fzdLOWRUgFCHYqwl@cluster0.fccao1l.mongodb.net/arena?retryWrites=true&w=majority&appName=Cluster0';

async function fixPlayerBalances() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer tous les jeux
    const games = await Game.find({});
    console.log(`📊 ${games.length} jeu(x) trouvé(s)\n`);

    let totalUpdated = 0;

    for (const game of games) {
      console.log(`\n🎮 Traitement du jeu: ${game.name}`);
      
      try {
        // Créer une connexion à la base de données du jeu
        const gameDbUri = `${MONGO_URI.split('/').slice(0, -1).join('/')}/game_${game._id}`;
        const gameConnection = await mongoose.createConnection(gameDbUri).asPromise();
        
        console.log(`  ✅ Connecté à la BD du jeu`);

        // Définir le schéma Player
        const playerSchema = new mongoose.Schema({
          userId: { type: mongoose.Schema.Types.ObjectId },
          inGameUsername: { type: String, required: true },
          inGameEmail: { type: String, required: true },
          inGamePassword: { type: String, required: true },
          inGameId: { type: String },
          level: { type: Number, default: 1 },
          experience: { type: Number, default: 0 },
          wins: { type: Number, default: 0 },
          losses: { type: Number, default: 0 },
          draws: { type: Number, default: 0 },
          soldeEnergie: { type: Number, default: 0 },
          soldePiece: { type: Number, default: 0 },
          statistics: { type: mongoose.Schema.Types.Mixed, default: {} },
          achievements: [{ type: String }],
          registeredAt: { type: Date, default: Date.now },
          lastActive: { type: Date, default: Date.now }
        }, { timestamps: true });

        const Player = gameConnection.model('Player', playerSchema);

        // Trouver tous les joueurs
        const allPlayers = await Player.find({});
        console.log(`  📋 ${allPlayers.length} joueur(s) trouvé(s)`);

        if (allPlayers.length === 0) {
          console.log(`  ⏭️ Aucun joueur à traiter`);
          await gameConnection.close();
          continue;
        }

        // Mettre à jour chaque joueur
        let updatedCount = 0;
        for (const player of allPlayers) {
          let needsUpdate = false;

          if (player.soldeEnergie === undefined || player.soldeEnergie === null) {
            player.soldeEnergie = 0;
            needsUpdate = true;
          }

          if (player.soldePiece === undefined || player.soldePiece === null) {
            player.soldePiece = 0;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await player.save();
            updatedCount++;
            console.log(`    ✅ ${player.inGameUsername}: soldePiece=${player.soldePiece}, soldeEnergie=${player.soldeEnergie}`);
          }
        }

        console.log(`  ✅ ${updatedCount} joueur(s) mis à jour`);
        totalUpdated += updatedCount;

        await gameConnection.close();

      } catch (gameError) {
        console.error(`  ❌ Erreur pour ${game.name}:`, gameError.message);
      }
    }

    console.log(`\n✅ Terminé! ${totalUpdated} joueur(s) mis à jour au total`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Déconnexion de MongoDB');
    process.exit(0);
  }
}

// Exécuter le script
fixPlayerBalances();
