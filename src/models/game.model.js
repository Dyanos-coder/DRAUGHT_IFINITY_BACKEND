const mongoose = require('mongoose');
const { Schema } = mongoose;

const gameSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  detailedDescription: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['sport', 'strategy', 'action', 'combat'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'coming_soon', 'development', 'maintenance', 'disabled'],
    default: 'development'
  },
  publisher: {
    type: String,
    required: true,
    trim: true
  },
  officialWebsite: {
    type: String,
    default: ''
  },
  logo: {
    type: String, // Stocké en base64
    default: ''
  },
  coverImage: {
    type: String, // Stocké en base64
    default: ''
  },
  screenshots: [{
    type: String // Stocké en base64
  }],
  trailerUrl: {
    type: String,
    default: ''
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  rules: {
    type: String,
    default: ''
  },
  supportedFormats: [{
    type: String
  }],
  averageMatchDuration: {
    type: Number,
    default: 15 // en minutes
  },
  analytics: {
    totalPlayers: {
      type: Number,
      default: 0
    },
    activeTournaments: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    }
  },
  databaseName: {
    type: String,
    default: null
  },
  databaseCreatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index pour la recherche
gameSchema.index({ name: 'text', publisher: 'text' });
gameSchema.index({ status: 1 });
gameSchema.index({ category: 1 });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
