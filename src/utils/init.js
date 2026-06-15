const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

/**
 * Initialisation du système avec un utilisateur admin par défaut
 */
const initializeAdmin = async () => {
  try {
    const admins = [
      {
        username: 'Dyanos',
        email: 'sannicharbel@gmail.com',
        password: 'SA101010@',
        referralCode: 'ADMIN001'
      },
      {
        username: 'Merveille',
        email: 'sinsinmerveille02@gmail.com',
        password: 'Y1A2W3E4o',
        referralCode: 'ADMIN002'
      },
      {
        username: 'Yannick',
        email: 'fushmantonjoker@gmail.com',
        password: 'Personnellement1###',
        referralCode: 'ADMIN003'
      }
    ];

    for (const adminData of admins) {
      const existingAdmin = await User.findOne({ email: adminData.email });

      if (!existingAdmin) {
        console.log(`Création du compte administrateur : ${adminData.email}`);

        const admin = new User({
          username: adminData.username,
          email: adminData.email,
          password: adminData.password, // à hasher si ce n'est pas fait automatiquement dans un middleware
          role: 'admin',
          profile: {
            bio: 'Administrateur principal de la plateforme ASC',
            country: 'BJ',
            createdAt: new Date()
          },
          statistics: {
            totalWins: 0,
            totalLosses: 0,
            ranking: 1,
            tournamentsPlayed: 0,
            tournamentsWon: 0
          },
          sponsorship: {
            referralCode: adminData.referralCode,
            level: 'Roi ASC',
            commissionEarned: 0
          },
          twoFactorEnabled: false
        });

        await admin.save();
        console.log(`✅ Compte ${admin.email} créé avec succès.`);
      } else {
        console.log(`ℹ️ Le compte ${adminData.email} existe déjà.`);
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation des comptes admin :", error);
  }
};


module.exports = {
  initializeAdmin
}; 
