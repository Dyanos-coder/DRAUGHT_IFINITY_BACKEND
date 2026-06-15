const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminLogSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetType: { type: String, enum: ['user', 'tournament', 'match', 'dispute', 'reward', 'other'], required: true },
  targetId: { type: Schema.Types.ObjectId },
  timestamp: { type: Date, default: Date.now },
  details: { type: String }
});

module.exports = mongoose.model('AdminLog', adminLogSchema); 