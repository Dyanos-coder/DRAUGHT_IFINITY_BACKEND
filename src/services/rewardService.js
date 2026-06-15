const Reward = require('../models/reward.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

/**
 * Allows a user to claim a reward.
 * Adds the reward amount to the user's balance and marks the reward as collected.
 * @param {string} userId - The ID of the user claiming the reward.
 * @param {string} rewardId - The ID of the reward to claim.
 * @returns {Promise<Object>} - The updated user and reward.
 * @throws {Error} If the reward is not found, not for the user, or already collected.
 */
async function claimReward(userId, rewardId) {
  const session = await mongoose.startSession();
  try {
    let updatedUser;
    let updatedReward;

    await session.withTransaction(async () => {
      const reward = await Reward.findById(rewardId).session(session);

      if (!reward) {
        throw new Error('Récompense non trouvée.');
      }

      if (reward.userId.toString() !== userId.toString()) {
        throw new Error('Cette récompense ne vous appartient pas.');
      }

      if (reward.status === 'collected') {
        throw new Error('Cette récompense a déjà été réclamée.');
      }

      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('Utilisateur non trouvé.');
      }

      // Add reward amount to the correct user field based on reward type
      if (reward.type === 'validation') {
        // Les récompenses de validation sont toujours ajoutées au solde (argent)
        user.solde = (user.solde || 0) + reward.amount;
      } else if (reward.type === 'win') {
        // Les récompenses de victoire vont dans le solde
        user.solde = (user.solde || 0) + reward.amount;
      } else if (reward.type === 'remboursement' || reward.type === 'sponsorship_tickets') {
        // Les remboursements et les tickets de parrainage sont en tickets
        user.ticketsDeTournois = (user.ticketsDeTournois || 0) + reward.amount;
      } else if (reward.type === 'participation' || reward.type === 'sponsorship') {
        // Les autres types de récompenses vont dans les points de fidélité
        user.pointsDeFidelite = (user.pointsDeFidelite || 0) + reward.amount;
      } else {
        console.warn(`[RewardService] Reward type "${reward.type}" not explicitly handled for balance/points update during claim.`);
      }
      
      // Mark reward as collected
      reward.status = 'collected';
      reward.date = new Date(); // Update the date to when it was collected

      updatedUser = await user.save({ session });
      updatedReward = await reward.save({ session });
    });

    return { user: updatedUser, reward: updatedReward };
  } catch (error) {
    console.error('[RewardService] Error claiming reward:', error);
    throw error; // Re-throw the error to be handled by the controller
  } finally {
    session.endSession();
  }
}

/**
 * Crée une récompense de tickets pour un nouveau niveau de parrainage
 */
async function createSponsorshipTicketsReward(userId, newLevel) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Obtenir le niveau de parrainage et les tickets associés
    const sponsorshipLevel = await user.getSponsorshipLevel();
    const tickets = sponsorshipLevel.rewardTickets;

    if (tickets <= 0) return;

    // Créer la récompense de tickets
    const ticketReward = new Reward({
      userId: user._id,
      amount: tickets,
      type: 'sponsorship_tickets',
      description: `${tickets} tickets gratuits pour avoir atteint le niveau ${newLevel}`,
      status: 'not_collected'
    });

    await ticketReward.save();

    // Ajouter la récompense à la liste des récompenses de l'utilisateur
    user.rewards.push(ticketReward._id);
    await user.save();

    console.log(`✅ Récompense de tickets créée: ${tickets} tickets pour ${user.username}`);
  } catch (error) {
    console.error('❌ Erreur lors de la création de la récompense de tickets:', error);
  }
}

module.exports = {
  claimReward,
  createSponsorshipTicketsReward
}; 