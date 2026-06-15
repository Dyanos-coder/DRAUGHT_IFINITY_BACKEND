const SponsorshipLevel = require('../models/sponsorshipLevel.model');
const User = require('../models/user.model');
const Reward = require('../models/reward.model');

/**
 * Récupérer tous les niveaux de parrainage
 */
exports.getSponsorshipLevels = async (req, res) => {
  try {
    const levels = await SponsorshipLevel.find().sort({ order: 1 });
    res.status(200).json({ levels });
  } catch (error) {
    console.error('Erreur lors de la récupération des niveaux de parrainage:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des niveaux de parrainage' });
  }
};

/**
 * Obtenir les statistiques de parrainage d'un utilisateur
 */
exports.getSponsorshipStats = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).populate('sponsorship.referrals');
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Calculer le nombre de filleuls actifs
    const activeReferralsCount = await user.getActiveReferralsCount();
    
    // Obtenir les détails de chaque filleul
    const referralsDetails = await Promise.all(user.sponsorship.referrals.map(async (referral) => {
      const isActive = await referral.isActiveReferral();
      return {
        _id: referral._id,
        username: referral.username,
        avatar: referral.avatar,
        isActive,
        statistics: {
          tournamentsPlayed: referral.statistics?.tournamentsPlayed || 0
        }
      };
    }));

    res.status(200).json({
      totalReferrals: user.sponsorship.referrals.length,
      activeReferrals: activeReferralsCount,
      referrals: referralsDetails,
      currentLevel: user.sponsorship.level,
      commissionEarned: user.sponsorship.commissionEarned
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de parrainage:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques de parrainage' });
  }
};

/**
 * Mettre à jour le niveau de parrainage d'un utilisateur
 */
exports.updateUserSponsorshipLevel = async (req, res) => {
  console.log('🔍 Début de la mise à jour du niveau de parrainage');
  console.log('👤 User ID from token:', req.userId);
  
  try {
    const userId = req.userId;
    if (!userId) {
      console.error('❌ Pas d\'ID utilisateur trouvé dans la requête');
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // Récupérer l'utilisateur avec tous les champs nécessaires
    const user = await User.findById(userId).populate('rewards');
    console.log('👥 Utilisateur trouvé:', user ? 'Oui' : 'Non');

    if (!user) {
      console.error('❌ Utilisateur non trouvé en base de données');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log('📊 Niveau actuel:', user.sponsorship.level);
    const oldLevel = user.sponsorship.level;
    
    // Forcer le recalcul du niveau
    const activeReferralsCount = await user.getActiveReferralsCount();
    console.log('📊 Nombre de filleuls actifs:', activeReferralsCount);
    
    // Récupérer tous les niveaux
    const levels = await SponsorshipLevel.find().sort({ minReferrals: 1 });
    console.log('📋 Niveaux disponibles:', levels.map(l => `${l.name} (min: ${l.minReferrals})`));

    // Trouver le niveau approprié en fonction du nombre de filleuls actifs
    let appropriateLevel = null;
    for (const level of levels) {
      if (activeReferralsCount >= level.minReferrals) {
        appropriateLevel = level;
      } else {
        break; // Sortir dès qu'on trouve un niveau qu'on n'atteint pas
      }
    }

    // Si aucun niveau approprié n'est trouvé, revenir au niveau de base
    if (!appropriateLevel) {
      console.log('📉 Régression au niveau de base');
      user.sponsorship.level = 'Aucun';
      user.sponsorship.levelId = null;
      await user.save();

      return res.status(200).json({
        message: 'Niveau de parrainage mis à jour (régression)',
        oldLevel,
        newLevel: 'Aucun',
        isRegression: true
      });
    }

    const newLevel = appropriateLevel.name;
    console.log(`📊 Nouveau niveau calculé: ${newLevel}`);

    // Vérifier si le niveau a changé (progression ou régression)
    if (oldLevel !== newLevel) {
      const isRegression = levels.find(l => l.name === oldLevel)?.minReferrals > appropriateLevel.minReferrals;
      console.log(`${isRegression ? '📉 Régression' : '📈 Progression'} de niveau détectée`);

      // En cas de progression uniquement, gérer les récompenses
      if (!isRegression && appropriateLevel.rewardTickets > 0) {
        // Vérifier si une récompense pour ce niveau et ce montant existe déjà
        const existingReward = await Reward.findOne({
          userId: user._id,
          type: 'sponsorship',
          amount: appropriateLevel.rewardTickets,
          description: new RegExp(`${appropriateLevel.rewardTickets} ticket.*niveau ${newLevel}`)
        });

        if (!existingReward) {
          console.log('🎫 Ajout des tickets de tournoi');
          
          // Ajouter directement les tickets à l'utilisateur
          user.ticketsDeTournois += appropriateLevel.rewardTickets;
          
          // Créer une récompense pour garder une trace
          const ticketReward = new Reward({
            userId: user._id,
            amount: appropriateLevel.rewardTickets,
            type: 'sponsorship',
            description: `${appropriateLevel.rewardTickets} ticket${appropriateLevel.rewardTickets > 1 ? 's' : ''} de tournoi ajouté${appropriateLevel.rewardTickets > 1 ? 's' : ''} pour avoir atteint le niveau ${newLevel}`,
            status: 'collected'
        });
        await ticketReward.save();
        user.rewards.push(ticketReward._id);
          console.log(`✅ ${appropriateLevel.rewardTickets} tickets de tournoi ajoutés`);
        } else {
          console.log('ℹ️ Une récompense identique existe déjà pour ce niveau');
        }
      }

      // Mettre à jour le niveau
      user.sponsorship.level = newLevel;
      user.sponsorship.levelId = appropriateLevel._id;
      await user.save();
      console.log('✅ Niveau mis à jour en base de données');
      
      return res.status(200).json({
        message: `Niveau de parrainage mis à jour (${isRegression ? 'régression' : 'progression'})`,
        oldLevel,
        newLevel,
        isRegression,
        ticketsAdded: (!isRegression && !existingReward) ? appropriateLevel.rewardTickets : 0
      });
    }

    console.log('ℹ️ Niveau déjà à jour');
    return res.status(200).json({
      message: 'Niveau de parrainage déjà à jour',
      currentLevel: oldLevel
    });

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du niveau de parrainage:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du niveau de parrainage' });
  }
}; 