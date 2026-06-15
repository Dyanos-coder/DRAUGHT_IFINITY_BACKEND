const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Register a new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Verify email
router.get('/verify-email/:token', authController.verifyEmail);

// Resend verification email
router.post('/resend-verification', verifyToken, authController.resendVerificationEmail);

// Logout user
router.post('/logout', verifyToken, authController.logout);

// Get current user (protected route)
router.get('/me', verifyToken, authController.getCurrentUser);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Demande d'OTP pour connexion/mot de passe oublié
router.post('/request-otp', authController.requestOtp);

// Vérification de l'OTP pour connexion ou reset
router.post('/verify-otp', authController.verifyOtp);

// Réinitialisation du mot de passe via OTP
router.post('/reset-password-otp', authController.resetPasswordOtp);

module.exports = router; 