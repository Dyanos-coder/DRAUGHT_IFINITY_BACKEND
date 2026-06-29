const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const friendController = require('../controllers/friend.controller');

// Recherche d'utilisateurs par pseudo
router.get('/search', verifyToken, friendController.searchUsers);

// Liste des amis
router.get('/', verifyToken, friendController.getFriends);

// Demandes d'amis envoyées/reçues
router.get('/requests', verifyToken, friendController.getFriendRequests);
router.post('/requests/:userId', verifyToken, friendController.sendFriendRequest);
router.post('/requests/:userId/accept', verifyToken, friendController.acceptFriendRequest);
router.post('/requests/:userId/decline', verifyToken, friendController.declineFriendRequest);

// Notifications
router.get('/notifications', verifyToken, friendController.getNotifications);
router.put('/notifications/read-all', verifyToken, friendController.markNotificationsRead);

// Profil public d'un utilisateur
router.get('/profile/:userId', verifyToken, friendController.getPublicProfile);

// Retirer un ami
router.delete('/:userId', verifyToken, friendController.removeFriend);

module.exports = router;
