const express = require('express');
const router = express.Router();
const gameLinkController = require('../controllers/gameLink.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(verifyToken);

// Lier un compte de jeu existant
router.post('/link-game-account', gameLinkController.linkGameAccount);

// Récupérer tous les jeux liés
router.get('/user/linked-games', gameLinkController.getLinkedGames);

// Délier un compte de jeu
router.delete('/unlink-game-account/:gameId', gameLinkController.unlinkGameAccount);

module.exports = router;
