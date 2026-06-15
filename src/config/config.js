require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGODB_URI ,
  jwtSecret: process.env.JWT_SECRET || 'cfc872d54eb75f029b94e36275cbb903',
  nodeEnv: process.env.NODE_ENV || 'development',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  cors: {
    origin: function (origin, callback) {
      // Autoriser les requêtes sans origin (comme les apps mobiles, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // En développement, autoriser tous les localhost
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      
      // En production ou si origin spécifique, vérifier la whitelist
      const allowedOrigins = process.env.FRONTEND_URL 
        ? [process.env.FRONTEND_URL]
        : ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10)
  },
  moneroo: {
    apiKey: process.env.MONEROO_API_KEY,
    secretKey: process.env.MONEROO_SECRET_KEY,
    environment: process.env.MONEROO_ENVIRONMENT || 'live',
    callbackUrl: process.env.MONEROO_CALLBACK_URL 
  },
  cinetpay: {
    apiKey: process.env.CINETPAY_API_KEY,
    apiPassword: process.env.CINETPAY_API_PASSWORD ,
    siteId: process.env.CINETPAY_SITE_ID ,
    environment: process.env.CINETPAY_ENVIRONMENT || 'PROD',
    callbackUrl: process.env.CINETPAY_CALLBACK_URL ,
    notificationUrl: process.env.CINETPAY_NOTIFICATION_URL 
  },
};

// Validation de la configuration
if (!config.mongoURI) {
  console.error('MONGODB_URI is not set in environment variables');
  process.exit(1);
}

if (!config.jwtSecret || config.jwtSecret === 'your_jwt_secret_key_here') {
  console.warn('Warning: Using default JWT secret. In production, set JWT_SECRET environment variable.');
}

module.exports = config; 