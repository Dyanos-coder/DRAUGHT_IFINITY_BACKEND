const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const monerooController = require('../controllers/monerooController');
const paymentController = require('../controllers/payment.controller');

// Route de base pour les paiements
router.get('/', verifyToken, (req, res) => {
  res.json({ message: 'API de paiement disponible' });
});

// Routes Moneroo
router.post('/withdraw', verifyToken, monerooController.withdraw);

// Routes CinetPay
router.post('/cinetpay/initiate', verifyToken, paymentController.initiateCinetPayTransaction);
router.post('/cinetpay/withdraw', verifyToken, paymentController.withdrawCinetPay);
router.post('/cinetpay/notification', paymentController.handleCinetPayNotification);
router.post('/cinetpay/payout-notification', paymentController.handleCinetPayPayoutNotification);
router.get('/cinetpay/status/:transactionId', verifyToken, paymentController.getCinetPayStatus);

module.exports = router; 