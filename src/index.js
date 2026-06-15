const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const mongoose = require('mongoose');
const config = require('./config/config');
const { initializeAdmin } = require('./utils/init');
const { ensureSubstitutePlayers } = require('./services/userService');
const SponsorshipLevel = require('./models/sponsorshipLevel.model');
const gameDatabaseService = require('./services/gameDatabaseService');
const { Server } = require('socket.io');
const RealtimeMatchmakingService = require('./services/realtimeMatchmakingService');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const communicationRoutes = require('./routes/communication.routes');
const rewardRoutes = require('./routes/reward.routes');
const paymentRoutes = require('./routes/payment.routes');
const matchRoutes = require('./routes/match.routes');
const disputeRoutes = require('./routes/dispute.routes');
const sponsorshipRoutes = require('./routes/sponsorship.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const gameRoutes = require('./routes/game.routes');
const gameDataRoutes = require('./routes/gameData.routes');
const gameLinkRoutes = require('./routes/gameLink.routes');
const gameTournamentRoutes = require('./routes/gameTournament.routes');
const walletRoutes = require('./routes/wallet.routes');
const Tournament = require('./models/tournament.model');
const { updateScheduledCommunications } = require('./controllers/communication.controller');
const monerooRoutes = require('./routes/moneroo.routes');
const puzzleRoutes = require('./routes/puzzle.routes');
const { ensureDailyPuzzles } = require('./services/puzzleService');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.cors,
});

const realtimeMatchmakingService = new RealtimeMatchmakingService(io);
realtimeMatchmakingService.attach();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors(config.cors));

// Configuration avancée de Morgan pour le logging
morgan.token('body', (req) => JSON.stringify(req.body));
morgan.token('response-time', (req, res) => {
  if (!res._header || !req._startAt) return '';
  const diff = process.hrtime(req._startAt);
  const time = diff[0] * 1e3 + diff[1] * 1e-6;
  return time.toFixed(2);
});

// Format personnalisé pour Morgan
const morganFormat = ':remote-addr - :method :url :status :response-time ms - :res[content-length] - :body';

// Logging middleware
app.use(morgan(morganFormat, {
  skip: (req, res) => res.statusCode < 400,
  stream: {
    write: (message) => {
      console.log('\x1b[33m%s\x1b[0m', message.trim()); // Jaune pour les logs
    }
  }
}));

// Logging des erreurs
app.use((err, req, res, next) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Erreur:', err.stack); // Rouge pour les erreurs
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Body parser middleware - Augmentation de la limite pour les images base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Fonction d'initialisation de la base de données
const initializeDatabase = async () => {
  try {
    // Initialiser les niveaux de parrainage
    await SponsorshipLevel.initializeLevels();
    console.log('✅ Base de données initialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1);
  }
};

// Connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(async () => {
    console.log('\x1b[32m%s\x1b[0m', '✅ Connecté à MongoDB');

    // Initialiser la base de données après la connexion
    await initializeDatabase();

    // Initialize admin user
    await initializeAdmin();
    console.log('\x1b[32m%s\x1b[0m', '✅ Admin initialisé avec succès');
    // Ensure substitute players exist
    await ensureSubstitutePlayers();
    console.log('\x1b[32m%s\x1b[0m', '✅ Substitute players check complete.');

    // Vérifier et créer les bases de données pour les jeux existants
    try {
      console.log('\x1b[36m%s\x1b[0m', '🔍 Vérification des bases de données des jeux...');
      await gameDatabaseService.verifyAndCreateMissingDatabases();
      console.log('\x1b[32m%s\x1b[0m', '✅ Bases de données des jeux vérifiées');

      // Initialiser les soldes (soldeEnergie, soldePiece) pour les joueurs existants
      console.log('\x1b[36m%s\x1b[0m', '💰 Initialisation des soldes des joueurs...');
      await gameDatabaseService.initializePlayerBalances();
      console.log('\x1b[32m%s\x1b[0m', '✅ Soldes des joueurs initialisés');
      // La génération des puzzles est désormais gérée par un job planifié
      // (voir ensureDailyPuzzlesJob plus bas) — non bloquant au démarrage.
    } catch (dbError) {
      console.error('\x1b[33m%s\x1b[0m', '⚠️ Erreur lors de la vérification des BDs des jeux:', dbError);
      // Ne pas arrêter le serveur si cette étape échoue
    }

    // Fonction pour mettre à jour automatiquement le statut des tournois selon les dates
    const updateTournamentStatuses = async () => {
      try {
        console.log("Vérification des statuts des tournois...");
        const currentDate = new Date();

        // Trouver les tournois "à venir" dont la date de début d'inscription est atteinte
        const upcomingTournaments = await Tournament.find({
          status: 'upcoming',
          registrationStart: { $lte: currentDate }
        });

        // Mettre à jour le statut des tournois "à venir" en "ouvert aux inscriptions"
        for (const tournament of upcomingTournaments) {
          await Tournament.findByIdAndUpdate(
            tournament._id,
            { status: 'open' },
            { new: true }
          );
          console.log(`Statut du tournoi ${tournament._id} mis à jour: 'open'`);
        }

        // Trouver les tournois "en inscription" dont la date du tournoi est atteinte
        const startingTournaments = await Tournament.find({
          status: 'open',
          date: { $lte: currentDate }
        });

        // Mettre à jour le statut des tournois "en inscription" en "en cours"
        for (const tournament of startingTournaments) {
          await Tournament.findByIdAndUpdate(
            tournament._id,
            { status: 'in-progress' },
            { new: true }
          );
          console.log(`Statut du tournoi ${tournament._id} mis à jour: 'in-progress'`);
        }
      } catch (error) {
        console.error("Erreur lors de la mise à jour des statuts des tournois:", error);
      }
    };

    // Planifier la vérification des statuts toutes les heures
    setInterval(updateTournamentStatuses, 60 * 60 * 1000);

    // Planifier la vérification des communications programmées toutes les 5 minutes
    setInterval(updateScheduledCommunications, 5 * 60 * 1000);

    // Exécuter une première vérification au démarrage
    setTimeout(updateTournamentStatuses, 10000); // Exécuter 10 secondes après le démarrage du serveur
    setTimeout(updateScheduledCommunications, 15000); // Exécuter 15 secondes après le démarrage du serveur

    // Planifier la vérification des transactions toutes les heures
    const { exec } = require('child_process');
    const runCheckTransactions = () => {
      exec('node ./check-transactions.js', { cwd: __dirname + '/../' }, (error, stdout, stderr) => {
        if (error) {
          console.error('Erreur lors de l\'exécution de check-transactions.js:', error);
        }
        if (stdout) console.log('[check-transactions]', stdout.trim());
        if (stderr) console.error('[check-transactions][stderr]', stderr.trim());
      });
    };
    setInterval(runCheckTransactions, 60 * 60 * 1000); // toutes les heures
    setTimeout(runCheckTransactions, 20000); // première exécution 20s après le démarrage

    // Génération proactive des puzzles du jour : back-fill du passé récent +
    // pré-génération de demain. Exécuté toutes les heures (rattrape le passage
    // de minuit UTC et récupère après un arrêt) + un premier passage au boot.
    const ensureDailyPuzzlesJob = async () => {
      try {
        const Game = require('./models/game.model');
        const draughtGame = await Game.findOne({ name: /draught/i });
        if (!draughtGame) return;
        const gameId = draughtGame._id.toString();
        // Les puzzles vivent dans la BD DU JEU : on a besoin de sa connexion.
        const connection = gameDatabaseService.getGameConnection(gameId);
        if (!connection) {
          console.log('\x1b[33m%s\x1b[0m', '⏭️ BD du jeu Dames pas encore prête, job puzzles ignoré');
          return;
        }
        // pastDays:30 → couvre toute la fenêtre visible du calendrier et
        // répare/régénère les anciens puzzles invalides sur cette plage.
        await ensureDailyPuzzles(connection, gameId, { pastDays: 30, futureDays: 1 });
      } catch (e) {
        console.error('\x1b[33m%s\x1b[0m', '⚠️ Erreur job puzzles quotidien:', e.message);
      }
    };
    setInterval(ensureDailyPuzzlesJob, 60 * 60 * 1000); // toutes les heures
    setTimeout(ensureDailyPuzzlesJob, 25000); // première exécution 25s après le démarrage
  })
  .catch(err => {
    console.error('\x1b[31m%s\x1b[0m', '❌ Erreur de connexion à MongoDB:', err);
    process.exit(1);
  });

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/moneroo', monerooRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/sponsorship', sponsorshipRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/game-data', gameDataRoutes);
app.use('/api', gameLinkRoutes);  // Routes pour lier/délier des comptes de jeux
app.use('/api/game-tournaments', gameTournamentRoutes);  // Routes pour les tournois de jeux
app.use('/api/wallet', walletRoutes);  // Routes pour le portefeuille (recharge ARN, etc.)
app.use('/api/puzzles', puzzleRoutes);  // Routes pour les puzzles du jour

// Default API route
app.get('/api', (req, res) => {
  res.json({
    message: 'DLS API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tournaments: '/api/tournaments',
      admin: '/api/admin',
      communications: '/api/communications',
      sponsorship: '/api/sponsorship'
    },
    docs: 'Pour plus d\'informations sur chaque endpoint, consultez la documentation'
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DLS API',
    version: '1.0.0',
    environment: config.nodeEnv
  });
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', `🚀 Serveur démarré sur le port ${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `🌍 Mode: ${config.nodeEnv}`);
}); 