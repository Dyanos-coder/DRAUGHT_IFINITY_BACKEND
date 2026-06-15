const express = require('express');
const router = express.Router();
const monerooController = require('../controllers/monerooController');
const { verifyToken } = require('../middleware/auth.middleware');

// Route pour initier un paiement
router.post('/initiate', verifyToken, monerooController.initiatePayment);

// Route pour gérer le callback de Moneroo
router.get('/callback', monerooController.handleCallback);

// Route pour recevoir les notifications webhook Moneroo
router.post('/webhook', monerooController.handleWebhook);

module.exports = router; 
 