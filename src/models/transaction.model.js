const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user: { // Alias pour userId (compatibilité)
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: [
      'deposit',
      'withdrawal',
      'purchase_zgeg',
      'purchase_arn',
      'recharge_arn',
      'reward_points',
      'exchange_points_ticket',
      'tournament_prize',
      'tournament_registration'
    ],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    enum: [
      'zgeg', 'arn', 'points', 'ticket',
      // Franc CFA
      'XOF', 'XAF',
      // Devises internationales
      'USD', 'EUR',
      // Afrique de l'Ouest
      'GHS', 'NGN',
      // Afrique du Nord
      'MAD', 'TND', 'EGP',
      // Afrique de l'Est
      'KES', 'UGX', 'TZS', 'RWF',
      // Afrique Centrale
      'CDF',
      // Afrique Australe
      'ZAR', 'BWP', 'ZMW',
      // Océan Indien
      'MGA',
      // Afrique lusophone
      'AOA', 'MZN'
    ],
    required: true
  },
  arnAmount: { // Montant en ARN pour les recharges
    type: Number
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  paymentMethod: { // Moyen de paiement (moneyfusion, moneroo, etc.)
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  },
  relatedTournament: {
    type: Schema.Types.ObjectId,
    ref: 'Tournament'
  },
  metadata: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

// Middleware pour synchroniser user et userId
transactionSchema.pre('save', function(next) {
  if (this.user && !this.userId) {
    this.userId = this.user;
  } else if (this.userId && !this.user) {
    this.user = this.userId;
  }
  next();
});

// Créer des index pour des recherches efficaces
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction; 