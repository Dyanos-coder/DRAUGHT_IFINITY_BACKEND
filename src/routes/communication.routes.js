const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// GET communications envoyées accessible à tous les utilisateurs connectés
router.get('/', verifyToken, communicationController.getAllCommunications);

// Les autres routes restent protégées admin
router.use(isAdmin);
router.get('/:id', communicationController.getCommunicationById);
router.post('/', communicationController.createCommunication);
router.put('/:id', communicationController.updateCommunication);
router.delete('/:id', communicationController.deleteCommunication);

module.exports = router; 