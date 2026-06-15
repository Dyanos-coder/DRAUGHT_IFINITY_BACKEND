const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');

/**
 * Récupérer toutes les transactions de l'utilisateur connecté
 */
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filtres optionnels
    const filter = { userId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.currency) filter.currency = req.query.currency;
    
    // Récupérer les transactions
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relatedTournament', 'title');
    
    // Compter le nombre total pour la pagination
    const total = await Transaction.countDocuments(filter);
    
    res.status(200).json({
      transactions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupérer les détails d'une transaction
 */
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Vérifier que la transaction existe et appartient à l'utilisateur
    const transaction = await Transaction.findOne({ 
      _id: id, 
      userId 
    }).populate('relatedTournament');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction non trouvée' });
    }
    
    res.status(200).json({ transaction });
  } catch (error) {
    console.error('Erreur lors de la récupération de la transaction:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Créer une nouvelle transaction
 */
exports.createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      amount, 
      type, 
      description, 
      currency, 
      relatedTournament,
      metadata,
      status = 'completed' // Valeur par défaut
    } = req.body;
    
    // Utiliser l'ID de l'utilisateur connecté automatiquement
    const userId = req.userId;
    
    // Créer la transaction
    const transaction = new Transaction({
      userId,
      amount,
      type,
      description,
      currency,
      relatedTournament,
      metadata,
      status,
      date: new Date()
    });
    
    // Si la transaction modifie le solde de l'utilisateur, mettre à jour
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    console.log('État initial du solde:', {
      solde: user.solde,
      pointsDeFidelite: user.pointsDeFidelite,
      ticketsDeTournois: user.ticketsDeTournois
    });
    
    // Ne mettre à jour les soldes que si la transaction est complétée
    if (status === 'completed') {
      // Mettre à jour le solde selon le type de transaction
      switch (type) {
        case 'deposit':
          if (currency === 'zgeg') {
            user.solde = (user.solde ?? 0) + amount;
          } else if (currency === 'points') {
            user.pointsDeFidelite = (user.pointsDeFidelite ?? 0) + amount;
          }
          break;
        case 'purchase_zgeg':
          if (currency === 'zgeg') {
            if ((user.solde ?? 0) < amount) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ message: 'Solde insuffisant pour effectuer cette transaction.' });
            }
            user.solde = (user.solde ?? 0) - amount;
            // Ajout du nombre de tickets achetés
            const quantity = req.body.quantity ? parseInt(req.body.quantity) : 1;
            user.ticketsDeTournois = (user.ticketsDeTournois ?? 0) + quantity;
          }
          break;
        case 'reward_points':
          if (currency === 'points') {
            user.pointsDeFidelite = (user.pointsDeFidelite ?? 0) + amount;
          }
          break;
        case 'exchange_points_ticket':
          if (currency === 'points') {
            if ((user.pointsDeFidelite ?? 0) < amount) {
              await session.abortTransaction();
              session.endSession();
              return res.status(403).json({ message: 'Points de fidélité insuffisants pour cet échange.' });
            }
            user.pointsDeFidelite = (user.pointsDeFidelite ?? 0) - amount;
            // Incrémenter le nombre de tickets (par défaut 1 par échange)
            user.ticketsDeTournois = (user.ticketsDeTournois ?? 0) + 1;
          }
          break;
        case 'tournament_prize':
          if (currency === 'zgeg') {
            user.solde = (user.solde ?? 0) + amount;
          }
          break;
        default:
          break;
      }
    }
    
    console.log('État final du solde:', {
      solde: user.solde,
      pointsDeFidelite: user.pointsDeFidelite,
      ticketsDeTournois: user.ticketsDeTournois
    });
    
    // Sauvegarder la transaction et mettre à jour l'utilisateur
    await transaction.save({ session });
    await user.save({ session });
    
    // Valider la transaction
    await session.commitTransaction();
    session.endSession();
    
    // Renvoyer la transaction et les soldes mis à jour
    res.status(201).json({
      message: 'Transaction créée avec succès',
      transaction,
      updatedBalances: {
        solde: user.solde || 0,
        pointsDeFidelite: user.pointsDeFidelite || 0,
        ticketsDeTournois: user.ticketsDeTournois || 0
      }
    });
  } catch (error) {
    // En cas d'erreur, annuler la transaction
    await session.abortTransaction();
    session.endSession();
    
    console.error('Erreur lors de la création de la transaction:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupérer le résumé des transactions (solde, total des points, etc.)
 */
exports.getTransactionsSummary = async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`Récupération du résumé des transactions pour l'utilisateur: ${userId}`);
    
    // Vérifier d'abord si des transactions existent pour cet utilisateur
    const hasTransactions = await Transaction.exists({ userId: userId });
    
    // Si aucune transaction n'existe, renvoyer des valeurs par défaut
    if (!hasTransactions) {
      console.log(`Aucune transaction trouvée pour l'utilisateur ${userId}`);
      return res.status(200).json({ 
        summary: {
          zgeg: { deposit: 0, purchase: 0, prize: 0, net: 0 },
          points: { earned: 0, spent: 0, net: 0 },
          tickets: 0
        }
      });
    }
    
    // Obtenir le résumé des transactions par devise
    let summary;
    try {
      summary = await Transaction.aggregate([
        { $match: { userId: userId } },
        { $group: {
            _id: { currency: '$currency', type: '$type' },
            total: { $sum: '$amount' }
          }
        }
      ]);
      
      console.log('Résultat de l\'agrégation pour le résumé:', JSON.stringify(summary));
    } catch (aggError) {
      console.error('Erreur lors de l\'agrégation pour le résumé:', aggError);
      return res.status(200).json({ 
        summary: {
          zgeg: { deposit: 0, purchase: 0, prize: 0, net: 0 },
          points: { earned: 0, spent: 0, net: 0 },
          tickets: 0,
          error: 'Erreur d\'agrégation'
        }
      });
    }
    
    // Formater les résultats
    const formattedSummary = {
      zgeg: { deposit: 0, purchase: 0, prize: 0, net: 0 },
      points: { earned: 0, spent: 0, net: 0 },
      tickets: 0
    };
    
    // Calculer les totaux par type et devise
    if (summary && Array.isArray(summary)) {
      summary.forEach(item => {
        if (item && item._id) {
          const { currency, type } = item._id;
          const total = item.total || 0;
          
          if (currency === 'zgeg') {
            if (type === 'deposit') {
              formattedSummary.zgeg.deposit += total;
              formattedSummary.zgeg.net += total;
            } else if (type === 'purchase_zgeg') {
              formattedSummary.zgeg.purchase += total;
              formattedSummary.zgeg.net -= total;
            } else if (type === 'tournament_prize') {
              formattedSummary.zgeg.prize += total;
              formattedSummary.zgeg.net += total;
            }
          } else if (currency === 'points') {
            if (type === 'reward_points') {
              formattedSummary.points.earned += total;
              formattedSummary.points.net += total;
            } else if (type === 'exchange_points_ticket') {
              formattedSummary.points.spent += total;
              formattedSummary.points.net -= total;
            }
          }
        }
      });
    }
    
    res.status(200).json({ summary: formattedSummary });
  } catch (error) {
    console.error('Erreur lors de la récupération du résumé des transactions:', error);
    res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Récupérer les gains mensuels
 */
exports.getMonthlyGains = async (req, res) => {
  try {
    const userId = req.userId;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // Date de début du mois en cours
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    
    console.log(`Récupération des gains mensuels pour l'utilisateur: ${userId}`);
    console.log(`Période: à partir de ${startOfMonth.toISOString()}`);
    
    // Calculer les gains du mois (dépôts + prix des tournois + récompenses win)
    let monthlyGains = 0;
    
    // 1. Calculer les gains des transactions
    const transactionsGains = await Transaction.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          type: { $in: ['deposit', 'tournament_prize'] },
          date: { $gte: startOfMonth }
        } 
      },
      { 
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    if (transactionsGains.length > 0) {
      monthlyGains += transactionsGains[0].total;
    }

    // 2. Calculer les gains des récompenses de type win
    const Reward = require('../models/reward.model');
    const rewardsGains = await Reward.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'win',
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    if (rewardsGains.length > 0) {
      monthlyGains += rewardsGains[0].total;
    }
    
    console.log('Gains mensuels calculés:', {
      transactionsTotal: transactionsGains.length > 0 ? transactionsGains[0].total : 0,
      rewardsTotal: rewardsGains.length > 0 ? rewardsGains[0].total : 0,
      total: monthlyGains
    });
    
    res.status(200).json({ 
      monthlyGains: monthlyGains,
      currency: 'XOF',  // Par défaut en FCFA (XOF)
      month: currentMonth + 1,
      year: currentYear
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des gains mensuels:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 