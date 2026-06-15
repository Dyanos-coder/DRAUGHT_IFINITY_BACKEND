const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/dispute.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Create a new dispute
router.post('/', verifyToken, disputeController.createDispute);

// Get all disputes (admin only)
router.get('/admin', verifyToken, isAdmin, disputeController.getAllDisputes);

// Get user's disputes
router.get('/user', verifyToken, disputeController.getUserDisputes);

// Get disputes for validator
router.get('/validator', verifyToken, disputeController.getValidatorDisputes);

// Get a specific dispute
router.get('/:id', verifyToken, disputeController.getDisputeById);

// Update dispute status (admin only)
router.put('/:id/status', verifyToken, isAdmin, disputeController.updateDisputeStatus);

// Update dispute by validator
router.put('/validator/:id', verifyToken, disputeController.updateDisputeByValidator);

module.exports = router; 