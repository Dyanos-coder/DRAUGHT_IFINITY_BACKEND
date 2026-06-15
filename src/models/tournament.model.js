const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  prize: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'open', 'in-progress', 'complete'],
    default: 'upcoming'
  },
  date: {
    type: Date,
    required: true
  },
  registrationStart: {
    type: Date
  },
  registrationDeadline: {
    type: Date
  },
  maxPlayers: {
    type: Number,
    required: true
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }],
  rules: {
    type: String
  },
  type: {
    type: String,
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  entryFee: {
    type: Number,
    required: true
  },
  firstPlaceReward: {
    type: Number,
    required: true
  },
  secondPlaceReward: {
    type: Number,
    required: true
  },
  thirdPlaceReward: {
    type: Number
  },
  hasGeneratedBracket: {
    type: Boolean,
    default: false
  },
  bracketGeneratedAt: {
    type: Date
  },
  matchTime: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Tournament = mongoose.model('Tournament', tournamentSchema);

module.exports = Tournament; 