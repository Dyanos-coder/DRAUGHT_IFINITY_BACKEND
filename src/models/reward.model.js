const mongoose = require('mongoose');
const { Schema } = mongoose;

const rewardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament' },
  type: { type: String, enum: ['win', 'participation', 'sponsorship', 'sponsorship_tickets', 'legendary', 'validation', 'remboursement'], required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  status: { type: String, enum: ['collected', 'not_collected'], default: 'not_collected' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Reward', rewardSchema); 