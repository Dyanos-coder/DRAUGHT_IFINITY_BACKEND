const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = require('mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  timezone: {
    type: String,
    default: 'GMT+0'
  },
  preferredCurrency: {
    type: String,
    enum: ['XOF', 'EUR', 'USD', 'MAD', 'NGN', 'GHS', 'ZAR'],
    default: 'XOF'
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'validator', 'substitute'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    required: false
  },
  verificationTokenExpires: {
    type: Date,
    required: false
  },
  isSubstitute: {
    type: Boolean,
    default: false
  },
  profile: {
    bio: { type: String },
    country: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  statistics: {
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    ranking: { type: Number, default: 0 },
    tournamentsPlayed: { type: Number, default: 0 },
    tournamentsWon: { type: Number, default: 0 }
  },
  rewards: [{ type: Schema.Types.ObjectId, ref: 'Reward' }],
  sponsorship: {
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    codeParrain: { type: String, default: null },
    referrals: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    level: { type: String, default: 'Aucun' },
    levelId: { type: Schema.Types.ObjectId, ref: 'SponsorshipLevel' },
    commissionEarned: { type: Number, default: 0 }
  },
  arnBalance: { type: Number, default: 0 }, // Solde ARN (monnaie du site)
  solde: { type: Number, default: 0 }, // Garde pour compatibilité, à migrer
  soldePiece: { type: Number, default: 0 }, // Pièces pour les jeux (ex: Draught Infinity)
  soldeEnergie: { type: Number, default: 0 }, // Énergie pour les jeux
  pointsDeFidelite: { type: Number, default: 0 },
  ticketsDeTournois: { type: Number, default: 0 },
  twoFactorEnabled: { type: Boolean, default: false },
  otpSecret: { type: String, default: null },
  isBanned: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  suspendedUntil: { type: Date },
  suspendedReason: { type: String },
  suspendedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  bannedReason: { type: String },
  bannedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  bannedAt: { type: Date },
  resetOtp: { type: String, default: null },
  resetOtpExpires: { type: Date, default: null },
  linkedGames: [{
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    gameName: { type: String },  // Cache pour affichage rapide
    playerId: { type: String, required: true },  // ID du Player dans la BD du jeu
    inGameUsername: { type: String },  // Cache
    inGameEmail: { type: String },  // Cache
    linkedAt: { type: Date, default: Date.now },
    cachedStats: {
      level: { type: Number, default: 1 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      experience: { type: Number, default: 0 },
      lastSynced: { type: Date, default: Date.now }
    },
    soldePiece: { type: Number, default: 10000000 }, // Pièces pour ce jeu
    soldeEnergie: { type: Number, default: 10000 }   // Énergie pour ce jeu
  }],
  ownedThemes: [{
    type: { type: String, enum: ['board', 'background'], required: true },
    path: { type: String, required: true },
    purchasedAt: { type: Date, default: Date.now },
    price: { type: Number, required: true }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ajout des index pour optimiser les requêtes fréquentes
// email, username et referralCode sont déjà indexés via unique: true
userSchema.index({ 'sponsorship.referredBy': 1 });
userSchema.index({ 'statistics.totalWins': -1, 'statistics.totalLosses': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isBanned: 1, isSuspended: 1 });
// Index pour éviter qu'un Player soit lié plusieurs fois au même User
userSchema.index({ 'linkedGames.gameId': 1, 'linkedGames.playerId': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Virtual for full profile URL
userSchema.virtual('fullProfileUrl').get(function() {
  return this.avatar || '';
});

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.otpSecret;
  return userObject;
};

// Méthode pour vérifier si un filleul est actif (a participé à au moins un tournoi)
userSchema.methods.isActiveReferral = async function() {
  try {
    // Vérifier si l'utilisateur a participé à au moins un tournoi
    const Tournament = mongoose.model('Tournament');
    const participations = await Tournament.countDocuments({
      'players': this._id,
      'status': { $in: ['in-progress', 'complete'] } // Ne compter que les tournois en cours ou terminés
    });
    
    console.log(`Vérification de l'activité du filleul ${this.username}: ${participations} tournois trouvés`);
    return participations > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'activité du filleul:', error);
    return false;
  }
};

// Méthode pour obtenir le niveau de parrainage en fonction du nombre de filleuls actifs
userSchema.methods.getSponsorshipLevel = async function() {
  try {
    const activeReferralsCount = await this.getActiveReferralsCount();
    const SponsorshipLevel = mongoose.model('SponsorshipLevel');
    
    // Trouver tous les niveaux triés par ordre croissant de minReferrals
    const levels = await SponsorshipLevel.find().sort({ minReferrals: 1 });
    
    // Trouver le niveau approprié en parcourant les niveaux
    let appropriateLevel = null;
    for (const level of levels) {
      if (activeReferralsCount >= level.minReferrals) {
        appropriateLevel = level;
      } else {
        break; // Sortir dès qu'on trouve un niveau qu'on n'atteint pas
      }
    }
    
    if (!appropriateLevel) {
      return {
        level: 'Aucun',
        levelId: null,
        rewardTickets: 0,
        earningsPercentage: 0,
        rechargePercentage: 0
      };
    }
    
    return {
      level: appropriateLevel.name,
      levelId: appropriateLevel._id,
      rewardTickets: appropriateLevel.rewardTickets,
      earningsPercentage: appropriateLevel.earningsPercentage,
      rechargePercentage: appropriateLevel.rechargePercentage
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du niveau de parrainage:', error);
    return {
      level: 'Aucun',
      levelId: null,
      rewardTickets: 0,
      earningsPercentage: 0,
      rechargePercentage: 0
    };
  }
};

// Méthode pour mettre à jour le niveau de parrainage
userSchema.methods.updateSponsorshipLevel = async function() {
  try {
    const sponsorshipInfo = await this.getSponsorshipLevel();
    
    // Mettre à jour le niveau et l'ID du niveau
    this.sponsorship.level = sponsorshipInfo.level;
    this.sponsorship.levelId = sponsorshipInfo.levelId;
    
    await this.save();
    
    return sponsorshipInfo;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du niveau de parrainage:', error);
    throw error;
  }
};

// Méthode pour obtenir le nombre de filleuls actifs
userSchema.methods.getActiveReferralsCount = async function() {
  try {
    const Tournament = mongoose.model('Tournament');
    
    // Utiliser une agrégation pour compter les filleuls actifs en une seule requête
    const result = await Tournament.aggregate([
      {
        $match: {
          'players': { $in: this.sponsorship.referrals },
          'status': { $in: ['in-progress', 'complete'] }
        }
      },
      {
        $group: {
          _id: '$players',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 0 }
        }
      },
      {
        $count: 'activeReferrals'
      }
    ]);

    const activeCount = result[0]?.activeReferrals || 0;
    console.log(`Nombre de filleuls actifs pour ${this.username}:`, activeCount);
    return activeCount;
  } catch (error) {
    console.error('Erreur lors du comptage des filleuls actifs:', error);
    return 0;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User; 