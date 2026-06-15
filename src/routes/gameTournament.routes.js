const express = require('express');
const router = express.Router();
const gameTournamentController = require('../controllers/gameTournament.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification admin
router.use(verifyToken);
router.use(isAdmin);

/**
 * Routes pour gérer les tournois spécifiques aux jeux
 * Les tournois sont stockés dans la base de données du jeu
 */

// Créer un tournoi pour un jeu spécifique
router.post('/:gameId', gameTournamentController.createGameTournament);

// Récupérer tous les tournois d'un jeu
router.get('/:gameId', gameTournamentController.getGameTournaments);

// Récupérer un tournoi spécifique
router.get('/:gameId/:tournamentId', gameTournamentController.getGameTournament);

// Mettre à jour un tournoi
router.put('/:gameId/:tournamentId', gameTournamentController.updateGameTournament);

// Supprimer un tournoi
router.delete('/:gameId/:tournamentId', gameTournamentController.deleteGameTournament);

// Inscrire un joueur à un tournoi
router.post('/:gameId/:tournamentId/register', gameTournamentController.registerPlayerToTournament);

// Retirer un joueur d'un tournoi
router.delete('/:gameId/:tournamentId/players/:playerId', gameTournamentController.unregisterPlayerFromTournament);

module.exports = router;
