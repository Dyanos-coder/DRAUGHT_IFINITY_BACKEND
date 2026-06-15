const express = require('express');
const router = express.Router();
const sponsorshipController = require('../controllers/sponsorship.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Récupérer tous les niveaux de parrainage
router.get('/levels', sponsorshipController.getSponsorshipLevels);

// Récupérer les statistiques de parrainage d'un utilisateur
router.get('/stats', verifyToken, sponsorshipController.getSponsorshipStats);

// Mettre à jour le niveau de parrainage de l'utilisateur
router.post('/update-level', verifyToken, sponsorshipController.updateUserSponsorshipLevel);

module.exports = router; 