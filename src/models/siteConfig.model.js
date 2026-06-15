const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema({
  // Prix de l'ARN en différentes devises africaines
  arnPrices: {
    // Franc CFA
    XOF: { type: Number, default: 100 },  // Franc CFA BCEAO (Afrique de l'Ouest)
    XAF: { type: Number, default: 100 },  // Franc CFA BEAC (Afrique Centrale)
    
    // Devises internationales
    USD: { type: Number, default: 0.17 },
    EUR: { type: Number, default: 0.15 },
    
    // Afrique de l'Ouest
    GHS: { type: Number, default: 2 },     // Cedi (Ghana)
    NGN: { type: Number, default: 270 },   // Naira (Nigeria)
    
    // Afrique du Nord
    MAD: { type: Number, default: 1.7 },   // Dirham (Maroc)
    TND: { type: Number, default: 0.5 },   // Dinar (Tunisie)
    EGP: { type: Number, default: 8 },     // Livre (Égypte)
    
    // Afrique de l'Est
    KES: { type: Number, default: 22 },    // Shilling (Kenya)
    UGX: { type: Number, default: 640 },   // Shilling (Ouganda)
    TZS: { type: Number, default: 430 },   // Shilling (Tanzanie)
    RWF: { type: Number, default: 220 },   // Franc (Rwanda)
    
    // Afrique Centrale
    CDF: { type: Number, default: 500 },   // Franc (Congo)
    
    // Afrique Australe
    ZAR: { type: Number, default: 3 },     // Rand (Afrique du Sud)
    BWP: { type: Number, default: 2.3 },   // Pula (Botswana)
    ZMW: { type: Number, default: 4 },     // Kwacha (Zambie)
    
    // Océan Indien
    MGA: { type: Number, default: 770 },   // Ariary (Madagascar)
    
    // Afrique lusophone
    AOA: { type: Number, default: 140 },   // Kwanza (Angola)
    MZN: { type: Number, default: 11 },    // Metical (Mozambique)
  },
  
  // Configuration MoneyFusion
  moneyFusion: {
    apiUrl: {
      type: String,
      default: '' // Doit être récupéré depuis le dashboard MoneyFusion
    },
    apiKey: { 
      type: String, 
      default: '' // Non utilisé avec MoneyFusion (la clé est dans l'URL)
    },
    enabled: { type: Boolean, default: true },
  },
  
  // Configuration des frais
  fees: {
    withdrawalPercentage: { type: Number, default: 2 }, // 2% de frais de retrait
    minimumWithdrawal: { type: Number, default: 1000 }, // Minimum 1000 ARN
  },
  
  // Dernière mise à jour
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

// Méthode pour obtenir la configuration (singleton pattern)
siteConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

// Méthode pour mettre à jour la configuration
siteConfigSchema.statics.updateConfig = async function(updates, userId) {
  let config = await this.findOne();
  if (!config) {
    config = new this(updates);
  } else {
    Object.assign(config, updates);
  }
  config.updatedBy = userId;
  config.updatedAt = new Date();
  await config.save();
  return config;
};

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
