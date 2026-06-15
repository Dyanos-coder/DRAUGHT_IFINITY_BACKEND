const mongoose = require('mongoose');
const { Schema } = mongoose;

const scoreSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true }
}, { _id: false });

const proofSchema = new Schema({
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['screenshot', 'video', 'text'], required: true },
  url: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const matchSchema = new Schema({
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  round: { type: Number, required: true },
  matchNumber: { type: Number, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  scores: [scoreSchema],
  player1Score: { type: Number },
  player2Score: { type: Number },
  date: { type: Date, required: true },
  time: { type: String },
  matchCode: { type: String, unique: true, sparse: true },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'dispute', 'bye'], 
    default: 'pending' 
  },
  winner: { type: Schema.Types.ObjectId, ref: 'User' },
  nextMatchId: { type: Schema.Types.ObjectId, ref: 'Match' },
  previousMatches: [{ type: Schema.Types.ObjectId, ref: 'Match' }],
  isBye: { type: Boolean, default: false },
  bracketPosition: {
    x: { type: Number },
    y: { type: Number }
  },
  proofs: [proofSchema],
  disputeId: { type: Schema.Types.ObjectId, ref: 'Dispute' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

matchSchema.virtual('isFirstRound').get(function() {
  return this.round === 1;
});

matchSchema.virtual('isFinal').get(function() {
  return !this.nextMatchId;
});

matchSchema.index({ tournamentId: 1, round: 1 });
matchSchema.index({ tournamentId: 1, status: 1 });

module.exports = mongoose.model('Match', matchSchema); 