const express = require('express');
const router = express.Router();
const gameDataController = require('../controllers/gameData.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

/**
 * Routes pour gérer les données des jeux dans leurs bases de données dédiées
 * Toutes les routes nécessitent une authentification
 */

// ============================================================
// ROUTES POUR LES TOURNOIS D'UN JEU
// ============================================================

/**
 * @route   GET /api/game-data/:gameId/tournaments
 * @desc    Récupérer la liste des tournois d'un jeu
 * @access  Private
 * @params  gameId - ID du jeu
 * @query   status - Filtrer par statut (upcoming, open, in-progress, complete)
 * @query   limit - Nombre de résultats par page (défaut: 20)
 * @query   page - Numéro de page (défaut: 1)
 */
router.get('/:gameId/tournaments', verifyToken, gameDataController.getGameTournaments);

// ============================================================
// ROUTES POUR LES JOUEURS D'UN JEU
// ============================================================

/**
 * @route   POST /api/game-data/:gameId/players/register
 * @desc    Inscrire un joueur dans la base de données d'un jeu
 * @access  Private
 * @params  gameId - ID du jeu
 * @body    {
 *            inGameUsername: string (requis),
 *            inGameEmail: string (requis),
 *            inGamePassword: string (requis),
 *            inGameId: string (optionnel)
 *          }
 */
router.post('/:gameId/players/register', verifyToken, gameDataController.registerPlayerInGame);

/**
 * @route   GET /api/game-data/:gameId/players/:userId
 * @desc    Obtenir les détails d'un joueur dans un jeu
 * @access  Private
 * @params  gameId - ID du jeu
 * @params  userId - ID de l'utilisateur
 */
router.get('/:gameId/players/:userId', verifyToken, gameDataController.getPlayerInGame);

/**
 * @route   GET /api/game-data/:gameId/players/:userId/matches
 * @desc    Obtenir l'historique des matchs d'un joueur dans un jeu
 * @access  Private
 * @params  gameId - ID du jeu
 * @params  userId - ID de l'utilisateur
 * @query   limit - Nombre de résultats par page (défaut: 20)
 * @query   page - Numéro de page (défaut: 1)
 */
router.get('/:gameId/players/:userId/matches', verifyToken, gameDataController.getPlayerMatchHistory);

/**
 * @route   GET /api/game-data/:gameId/players/checkers/progress
 * @desc    Récupérer la progression des niveaux de dames du joueur
 * @access  Private
 * @params  gameId - ID du jeu (doit être le jeu Dames)
 */
router.get('/:gameId/players/checkers/progress', verifyToken, gameDataController.getCheckersProgress);

/**
 * @route   PUT /api/game-data/:gameId/players/checkers/progress
 * @desc    Mettre à jour la progression des niveaux de dames du joueur
 * @access  Private
 * @params  gameId - ID du jeu (doit être le jeu Dames)
 * @body    { gameType: string, level: number }
 */
router.put('/:gameId/players/checkers/progress', verifyToken, gameDataController.updateCheckersProgress);

// ============================================================
// ROUTES POUR LES MATCHS D'UN JEU
// ============================================================

/**
 * @route   PUT /api/game-data/:gameId/matches/:matchId/score
 * @desc    Mettre à jour le score d'un match dans la base de données d'un jeu
 * @access  Private (joueur du match ou admin)
 * @params  gameId - ID du jeu
 * @params  matchId - ID du match dans la base du jeu
 * @body    {
 *            scores: [{ playerId: ObjectId, score: number }] (requis),
 *            winner: ObjectId (optionnel),
 *            status: string (optionnel) - 'pending', 'in_progress', 'completed', 'cancelled', 'disputed',
 *            matchData: object (optionnel) - données supplémentaires du match
 *          }
 */
router.put('/:gameId/matches/:matchId/score', verifyToken, gameDataController.updateMatchScore);

/**
 * @route   GET /api/game-data/:gameId/active-tournaments
 * @desc    Récupérer les tournois actifs depuis la base de données du jeu
 * @access  Private
 * @params  gameId - ID du jeu
 * @query   limit - Nombre de résultats (défaut: 20)
 */
router.get('/:gameId/active-tournaments', verifyToken, gameDataController.getActiveTournamentsFromGameDB);

/**
 * @route   POST /api/game-data/:gameId/tournaments/:tournamentId/join
 * @desc    Rejoindre un tournoi (inscription joueur avec déduction des pièces)
 * @access  Private
 * @params  gameId - ID du jeu
 * @params  tournamentId - ID du tournoi
 */
router.post('/:gameId/tournaments/:tournamentId/join', verifyToken, gameDataController.joinTournament);

module.exports = router;
