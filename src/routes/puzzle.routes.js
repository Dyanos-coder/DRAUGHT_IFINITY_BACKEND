const express = require('express');
const router = express.Router();
const puzzleController = require('../controllers/puzzle.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// GET /api/puzzles/:gameId — Calendrier des puzzles
router.get('/:gameId', verifyToken, puzzleController.getCalendar);

// GET /api/puzzles/:gameId/:date — Puzzle d'une date (format YYYY-MM-DD)
router.get('/:gameId/:date', verifyToken, puzzleController.getPuzzleByDate);

// POST /api/puzzles/:gameId/:puzzleId/solve — Soumettre une solution
router.post('/:gameId/:puzzleId/solve', verifyToken, puzzleController.solvePuzzle);

module.exports = router;
