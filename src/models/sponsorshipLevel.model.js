const mongoose = require('mongoose');
const { Schema } = mongoose;

const sponsorshipLevelSchema = new Schema({
  name: { type: String, required: true, unique: true },
  minReferrals: { type: Number, required: true },
  rewardTickets: { type: Number, required: true },
  earningsPercentage: { type: Number, required: true },
  rechargePercentage: { type: Number, required: true },
  order: { type: Number, required: true } // Pour maintenir l'ordre des niveaux
});

// Méthode statique pour initialiser les niveaux de parrainage
sponsorshipLevelSchema.statics.initializeLevels = async function() {
  const levels = [
    {
      name: 'Esclave ASC',
      minReferrals: 1,
      rewardTickets: 0,
      earningsPercentage: 0,
      rechargePercentage: 0.5,
      order: 1
    },
    {
      name: 'Paysan ASC',
      minReferrals: 3,
      rewardTickets: 1,
      earningsPercentage: 0,
      rechargePercentage: 1,
      order: 2
    },
    {
      name: 'Roturier ASC',
      minReferrals: 10,
      rewardTickets: 2,
      earningsPercentage: 2,
      rechargePercentage: 2,
      order: 3
    },
    {
      name: 'Noble ASC',
      minReferrals: 50,
      rewardTickets: 3,
      earningsPercentage: 5,
      rechargePercentage: 4,
      order: 4
    },
    {
      name: 'Chef de caste',
      minReferrals: 100,
      rewardTickets: 5,
      earningsPercentage: 10,
      rechargePercentage: 5,
      order: 5
    },
    {
      name: 'Gouverneur ASC',
      minReferrals: 500,
      rewardTickets: 20,
      earningsPercentage: 15,
      rechargePercentage: 5,
      order: 6
    },
    {
      name: 'Roi ASC',
      minReferrals: 1000,
      rewardTickets: 40,
      earningsPercentage: 20,
      rechargePercentage: 7,
      order: 7
    },
    {
      name: 'Empereur ASC',
      minReferrals: 5000,
      rewardTickets: 200,
      earningsPercentage: 25,
      rechargePercentage: 10,
      order: 8
    },
    {
      name: 'Emblème ASC',
      minReferrals: 10000,
      rewardTickets: 400,
      earningsPercentage: 25,
      rechargePercentage: 13,
      order: 9
    }
  ];

  try {
    // Supprimer tous les niveaux existants
    await this.deleteMany({});
    
    // Insérer les nouveaux niveaux
    await this.insertMany(levels);
    
    console.log('✅ Niveaux de parrainage initialisés avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des niveaux de parrainage:', error);
    throw error;
  }
};

const SponsorshipLevel = mongoose.model('SponsorshipLevel', sponsorshipLevelSchema);

module.exports = SponsorshipLevel; 