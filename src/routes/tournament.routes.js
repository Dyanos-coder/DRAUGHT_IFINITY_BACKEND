const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournament.controller');
const { verifyToken, isAdmin, isVerified } = require('../middleware/auth.middleware');

// Public routes
router.get('/', tournamentController.getAllTournaments);
router.get('/user/tournaments', verifyToken, tournamentController.getUserTournaments);
router.get('/:id', tournamentController.getTournamentById);

// Protected routes
router.post('/', verifyToken, isVerified, isAdmin, tournamentController.createTournament);
router.put('/:id', verifyToken, isVerified, isAdmin, tournamentController.updateTournament);
router.delete('/:id', verifyToken, isVerified, isAdmin, tournamentController.deleteTournament);
router.post('/:id/register', verifyToken, isVerified, tournamentController.registerForTournament);

// Routes pour l'arbre de tournoi
router.post('/:tournamentId/generate-bracket', verifyToken, isVerified, isAdmin, tournamentController.generateBracket);
router.post('/:tournamentId/bracket/generate', verifyToken, isVerified, isAdmin, tournamentController.generateBracket);
router.get('/:tournamentId/bracket', verifyToken, tournamentController.getTournamentBracket);
router.put('/matches/:matchId/result', verifyToken, isVerified, tournamentController.updateMatchResult);

// Nouvelle route pour la mise à jour manuelle de l'arbre
router.post('/:tournamentId/update-bracket', verifyToken, isVerified, isAdmin, tournamentController.updateBracket);

module.exports = router; 