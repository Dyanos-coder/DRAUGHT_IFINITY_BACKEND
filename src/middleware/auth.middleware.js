const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/user.model');

exports.verifyToken = async (req, res, next) => {
  console.log('🔒 Vérification du token');
  const authHeader = req.headers.authorization;
  
  console.log('📨 Headers de la requête:', req.headers);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Pas de token ou format invalide');
    return res.status(401).json({ 
      message: 'No token provided or invalid token format',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('🎫 Token trouvé');

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log('✅ Token décodé avec succès:', decoded);
    
    // Déterminer si c'est un Player (jeu) ou un User (site web)
    if (decoded.playerId && decoded.gameId) {
      // C'est un joueur dans un jeu spécifique
      console.log('🎮 Mode Player - gameId:', decoded.gameId, 'playerId:', decoded.playerId);
      req.user = {
        playerId: decoded.playerId,
        gameId: decoded.gameId,
        role: decoded.role || 'player',
        inGameUsername: decoded.inGameUsername
      };
      req.userId = decoded.playerId; // Pour compatibilité
      req.userRole = decoded.role || 'player';
      
      console.log('👤 Joueur ajouté à la requête');
      next();
    } else if (decoded.id) {
      // C'est un utilisateur du site web
      console.log('🌐 Mode User - userId:', decoded.id);
      const user = await User.findById(decoded.id);

      if (!user) {
        console.error('❌ Utilisateur associé au token non trouvé');
        return res.status(401).json({ message: 'Authentication failed', code: 'USER_NOT_FOUND' });
      }
      
      req.user = user;
      req.userId = user._id;
      req.userRole = user.role;
      
      console.log('👤 Utilisateur complet ajouté à la requête');
      next();
    } else {
      console.error('❌ Token invalide - ni playerId ni id présent');
      return res.status(401).json({ message: 'Invalid token format', code: 'INVALID_TOKEN_FORMAT' });
    }
  } catch (error) {
    console.error('❌ Erreur de vérification du token:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    return res.status(401).json({ 
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Requires admin role' });
  }
  next();
};

exports.isVerified = (req, res, next) => {
  if (!req.user || !req.user.isVerified) {
    console.warn(`🔒 Accès bloqué pour l'utilisateur non vérifié: ${req.user.email}`);
    return res.status(403).json({
      message: 'Votre compte doit être vérifié pour effectuer cette action. Veuillez vérifier vos e-mails.',
      code: 'ACCOUNT_NOT_VERIFIED'
    });
  }
  next();
};

exports.isValidator = (req, res, next) => {
  if (req.userRole !== 'validator' && req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Requires validator role' });
  }
  next();
}; 