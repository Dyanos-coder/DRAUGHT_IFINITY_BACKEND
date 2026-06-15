const monerooService = require('../services/monerooService');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const { PaymentMethod, PaymentMethodUtils } = require('moneroo-nodejs-sdk');
const config = require('../config/config');

exports.initiatePayment = async (req, res) => {
  try {
    const { amount, description, paymentMethod, country, phoneNumber } = req.body;
    const userId = req.user.id;

    // Vérification du montant
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Montant invalide.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Générer firstName et lastName selon la logique demandée
    let firstName = user.username || '';
    let lastName = user.username || '';
    if (firstName.includes(' ')) {
      const parts = firstName.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else if (!lastName) {
      lastName = firstName;
    }

    // On reçoit maintenant le code exact du mode de paiement (ex: mtn_bj)
    const selectedCountry = country || user.country || 'BJ';
    let methodsToSend;
    if (paymentMethod && typeof paymentMethod === 'string') {
      methodsToSend = [paymentMethod];
    } else {
      // fallback: toutes les méthodes du pays
      const availableMethods = PaymentMethodUtils.getByCountry(selectedCountry);
      methodsToSend = Array.isArray(availableMethods) ? availableMethods : [availableMethods];
    }

    // Préparer les données pour Moneroo
    const paymentData = {
      amount: parsedAmount,
      currency: 'XOF',
      description,
      email: user.email,
      firstName,
      lastName,
      returnUrl: `${process.env.BACKEND_URL || config.backendUrl}/api/payments/moneroo/callback`,
      methods: methodsToSend,
      phoneNumber
    };

    console.log('Payment params envoyés à Moneroo:', paymentData);
    const result = await monerooService.initiatePayment(paymentData);
    console.log('Réponse Moneroo brute:', result);

    // Créer une transaction en attente
    const transaction = new Transaction({
      userId: userId,
      amount: parsedAmount,
      currency: 'XOF',
      type: 'deposit',
      status: 'pending',
      description,
      metadata: {
        monerooId: result.data?.id,
        paymentUrl: result.data?.checkout_url,
        paymentMethod: paymentMethod || 'all',
        country: selectedCountry,
        phoneNumber
      }
    });

    await transaction.save();

    res.json({
      success: true,
      data: {
        paymentUrl: result.data?.checkout_url,
        transactionId: transaction._id
      }
    });
  } catch (error) {
    console.error('Error initiating Moneroo payment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initiation du paiement'
    });
  }
};

exports.handleCallback = async (req, res) => {
  try {
    console.log('Callback Moneroo reçu:', req.query);
    const transaction_id = req.query.transaction_id || req.query.paymentId;
    const status = req.query.status || req.query.paymentStatus;


    if (!transaction_id) {
      console.error('Transaction ID manquant dans le callback');
      return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=error&message=Transaction ID manquant`);
    }

    const transaction = await Transaction.findOne({ 'metadata.monerooId': transaction_id });
    if (!transaction) {
      console.error('Transaction non trouvée pour ID:', transaction_id);
      return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=error&message=Transaction non trouvée`);
    }

    console.log('Transaction trouvée:', {
      id: transaction._id,
      status: transaction.status,
      amount: transaction.amount,
      userId: transaction.userId
    });

    if (status && status.toLowerCase() === 'success') {
      // Vérifier si la transaction n'a pas déjà été traitée
      if (transaction.status === 'completed') {
        console.log('Transaction déjà complétée, redirection vers le frontend');
        return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=success&message=Paiement déjà traité`);
      }

      transaction.status = 'completed';
      await transaction.save();

      // Mettre à jour le solde de l'utilisateur
      const user = await User.findById(transaction.userId);
      if (user) {
        user.solde = (user.solde || 0) + transaction.amount;
        await user.save();
        console.log(`Solde utilisateur mis à jour: ${user.username} - Nouveau solde: ${user.solde}`);
      }

      console.log('Paiement traité avec succès, redirection vers le frontend');
      return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=success&message=Paiement traité avec succès`);
    } else if (status && status.toLowerCase() === 'pending') {
      transaction.status = 'pending';
      await transaction.save();
      console.log('Paiement en attente, redirection vers le frontend');
      return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=pending&message=Paiement en attente`);
    } else {
      transaction.status = 'failed';
      await transaction.save();
      console.log('Paiement échoué, redirection vers le frontend');
      return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=failed&message=Paiement échoué`);
    }
  } catch (error) {
    console.error('Error handling Moneroo callback:', error);
    return res.redirect(`${process.env.FRONTEND_URL || config.frontendUrl}/wallet?status=error&message=Erreur lors du traitement du paiement`);
  }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, method, msisdn, country, customer } = req.body;
    const userId = req.user.id;
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Montant invalide.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.solde < parsedAmount) {
      return res.status(400).json({ message: 'Solde insuffisant.' });
    }
    
    const fee = Math.ceil(parsedAmount * 0.05); // 5% de frais, arrondi à l'entier supérieur
    const totalDebited = parsedAmount + fee;
    if (user.solde < totalDebited) {
      return res.status(400).json({ message: 'Solde insuffisant.' });
    }
    // Débiter immédiatement le solde utilisateur
    user.solde = user.solde - totalDebited;
    await user.save();
    // Créer la transaction de retrait (pending)
    const transaction = new Transaction({
      userId: userId,
      amount: parsedAmount,
      currency: 'XOF',
      type: 'withdrawal',
      status: 'completed',
      description: `Retrait de ${parsedAmount} XOF via ${method} (frais: ${fee} XOF, total débité: ${totalDebited} XOF)`,
      metadata: {
        method,
        msisdn,
        country,
        customer
      }
    });
    await transaction.save();

    // Préparer les données pour Moneroo payout
    const payoutData = {
      amount: parsedAmount,
      currency: 'XOF',
      description: `Retrait de ${parsedAmount} XOF`,
      method,
      customer: {
        email: customer?.email || user.email,
        first_name: customer?.first_name || user.username,
        last_name: customer?.lastName || user.username
      },
      recipient: {
        msisdn: msisdn
      }
    };
    console.log('[Retrait Moneroo] Payload reçu du frontend:', req.body);
    console.log('[Retrait Moneroo] Payload envoyé à Moneroo:', payoutData);
    try {
      const payoutResult = await monerooService.payoutDirect(payoutData);
      console.log('[Moneroo Controller] Résultat du payout:', payoutResult);
      
      // Vérifier si la réponse est valide
      if (payoutResult && payoutResult.data && payoutResult.data.id) {
        // Mettre à jour la transaction avec l'ID Moneroo
        transaction.metadata.monerooId = payoutResult.data.id;
        // Le statut reste 'pending'. La déduction du solde se fera via le webhook 'payout.completed'.
        await transaction.save();

        return res.json({
          success: true,
          message: 'Retrait initié avec succès. Votre solde sera déduit une fois le paiement confirmé.',
          data: {
            payoutId: payoutResult.data.id,
            status: payoutResult.data.status,
            amount: payoutResult.data.amount,
            currency: payoutResult.data.currency
          }
        });
      } else {
        // Échec de l'initiation du payout Moneroo
        transaction.status = 'failed'; // Marquer la transaction comme échouée
        await transaction.save(); // Sauvegarder le statut d'échec
        return res.status(400).json({
          success: false,
          message: 'Échec de l\'initiation du retrait. Votre solde n\'a pas été déduit.',
          error: payoutResult?.message || 'Réponse invalide de Moneroo'
        });
      }
    } catch (error) {
      // Erreur lors de l'appel à Moneroo (problème de réseau, etc.)
      transaction.status = 'failed'; // Marquer la transaction comme échouée
      await transaction.save(); // Sauvegarder le statut d'échec
      return res.status(500).json({ success: false, message: error.message || 'Erreur lors du retrait Moneroo. Votre solde n\'a pas été déduit.' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors du retrait.' });
  }
};

// Webhook Moneroo pour payout
exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body;
    console.log('[Moneroo Webhook] Event reçu:', JSON.stringify(event, null, 2));
    const eventType = event.type || event.event;
    if (!eventType || !event.data) {
      return res.status(400).json({ message: 'Event Moneroo invalide' });
    }
    // Succès du payout
    if (eventType === 'payout.completed' || eventType === 'payout.success') {
      const payoutId = event.data.id;
      // Retrouver la transaction par payoutId (id Moneroo)
      const transaction = await Transaction.findOne({ 'metadata.monerooId': payoutId });
      if (transaction && transaction.status !== 'completed') {
        transaction.status = 'completed';
        await transaction.save();
        // Succès : ne rien faire, le solde a déjà été débité
      }
      return res.status(200).json({ received: true });
    }
    // Échec du payout
    if (eventType === 'payout.failed' || eventType === 'payout.error' || eventType === 'payout.failure') {
      const payoutId = event.data.id;
      const transaction = await Transaction.findOne({ 'metadata.monerooId': payoutId });
      if (transaction && transaction.status !== 'failed') {
        transaction.status = 'failed';
        await transaction.save();
        // Rembourser le solde utilisateur
        const user = await User.findById(transaction.userId);
        if (user) {
          const fee = transaction.metadata.fee || Math.ceil(transaction.amount * 0.05);
          const totalDebited = transaction.metadata.totalDebited || (transaction.amount + fee);
          user.solde = (user.solde || 0) + totalDebited;
          await user.save();
        }
      }
      return res.status(200).json({ received: true });
    }
    // Si l'événement n'est pas reconnu
    return res.status(400).json({ message: 'Type d\'événement non géré' });
  } catch (error) {
    console.error('[Moneroo Webhook] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors du traitement du webhook Moneroo' });
  }
}; 
