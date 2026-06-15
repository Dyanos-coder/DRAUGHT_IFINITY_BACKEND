const mongoose = require('mongoose');
const { Schema } = mongoose;

const proofSchema = new Schema({
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['screenshot', 'video', 'text'], required: true },
  url: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const validatorSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  decision: { type: String, enum: ['approve', 'reject'], required: true },
  comment: String
}, { _id: false });

const disputeSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  opponentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['Match Result Submission', 'Gameplay issue/Complaint']
  },
  category: {
    type: String,
    required: true,
    enum: ['match_result', 'complaint']
  },
  description: {
    type: String,
    required: true
  },
  proofUrl: {
    type: String
  },
  playerScore: {
    type: Number
  },
  opponentScore: {
    type: Number
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminComment: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  proofs: [proofSchema],
  validators: [validatorSchema],
  finalDecision: { type: String, enum: ['approve', 'reject', null], default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema); 