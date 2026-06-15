const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Routes publiques (accessible à tous les utilisateurs connectés)
router.get('/', verifyToken, gameController.getAllGames);
router.get('/:id', verifyToken, gameController.getGameById);

// Routes admin uniquement
router.post('/', verifyToken, isAdmin, gameController.createGame);
router.put('/:id', verifyToken, isAdmin, gameController.updateGame);
router.delete('/:id', verifyToken, isAdmin, gameController.deleteGame);
router.patch('/:id/analytics', verifyToken, isAdmin, gameController.updateGameAnalytics);

// Routes de gestion des bases de données (admin uniquement)
router.post('/databases/verify', verifyToken, isAdmin, gameController.verifyGamesDatabases);
router.post('/:id/database', verifyToken, isAdmin, gameController.createGameDatabase);
router.delete('/:id/database', verifyToken, isAdmin, gameController.deleteGameDatabase);
router.get('/:id/database/info', verifyToken, isAdmin, gameController.getGameDatabaseInfo);

module.exports = router;
