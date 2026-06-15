const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Recharge ARN via MoneyFusion
router.post('/recharge-arn', verifyToken, walletController.rechargeArn);

// Callback MoneyFusion (webhook)
router.post('/moneyfusion-callback', walletController.moneyFusionCallback);

// Historique des recharges ARN
router.get('/arn-recharge-history', verifyToken, walletController.getArnRechargeHistory);

module.exports = router;
