const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const tournamentRoutes = require('./tournament.routes');
const matchRoutes = require('./match.routes');
const disputeRoutes = require('./dispute.routes');
const rewardRoutes = require('./reward.routes');
const paymentRoutes = require('./payment.routes');
const sponsorshipRoutes = require('./sponsorship.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tournaments', tournamentRoutes);
router.use('/matches', matchRoutes);
router.use('/disputes', disputeRoutes);
router.use('/rewards', rewardRoutes);
router.use('/payments', paymentRoutes);
router.use('/sponsorship', sponsorshipRoutes);

module.exports = router; 