const axios = require('axios');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const config = require('../config/config');
const mongoose = require('mongoose');
const cinetpayService = require('../services/cinetpayService');

function formatPhoneNumber(phone) {
  if (!phone) {
    throw new Error('Le numéro de téléphone est requis');
  }

  // Nettoyer le numéro (enlever les espaces, tirets, etc.)
  let cleaned = phone.replace(/\D/g, '');
  
  console.log('Numéro avant traitement:', cleaned);
  
  // Si le numéro commence par +229 ou 229, l'enlever
  if (cleaned.startsWith('229')) {
    cleaned = cleaned.substring(3);
    console.log('Après suppression préfixe pays:', cleaned);
  }
  
  // Si le numéro commence par 0, l'enlever
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    console.log('Après suppression 0 initial:', cleaned);
  }
  
  console.log('Longueur finale du numéro:', cleaned.length);
  
  // Vérifier que le numéro a 8 ou 10 chiffres après nettoyage
  if (cleaned.length !== 8 && cleaned.length !== 10) {
    throw new Error(`Format de numéro invalide: ${cleaned.length} chiffres trouvés, 8 ou 10 attendus. Format attendu: 8 ou 10 chiffres sans le 0 initial ni l'indicatif pays. Exemple: 56962433 ou 22956962433`);
  }

  // Vérifier que le préfixe est valide pour le Bénin
  const prefix = cleaned.substring(0, 2);
  const validPrefixes = ['51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '66', '67', '68', '69', '90', '91', '92', '93', '94', '95', '96', '97', '40', '41', '42', '43', '44', '45', '01', '02', '03', '05', '06', '07', '08', '09'];
  
  if (!validPrefixes.includes(prefix)) {
    throw new Error(`Préfixe de numéro "${prefix}" invalide pour le Bénin. Préfixes valides: ${validPrefixes.join(', ')}`);
  }
  
  // Retourner uniquement les 8 chiffres sans le préfixe pays
  console.log('Numéro formaté final (8 chiffres):', cleaned);
  return cleaned;
}

// Fonction utilitaire pour obtenir les préfixes valides par opérateur
function getOperatorPrefixes(operator) {
  switch(operator.toUpperCase()) {
    case 'MTN':
      return ['05', '06', '51', '52', '53', '54', '55', '56', '57', '58', '59', '67', '68', '69', '66', '60', '61'];
    case 'MOOV':
      return ['01', '02', '03', '40', '41', '42', '43', '44', '45'];
    case 'ORANGE':
      return ['07', '08', '09', '90', '91', '92', '93', '94', '95', '96', '97'];
    default:
      return [];
  }
}

exports.initiateCinetPayTransaction = async (req, res) => {
  try {
    const {
      apikey,
      site_id,
      transaction_id,
      amount,
      currency,
      alternative_currency,
      description,
      customer_id,
      customer_name,
      customer_surname,
      customer_email,
      customer_phone_number,
      customer_address,
      customer_city,
      customer_country,
      customer_state,
      customer_zip_code,
      notify_url,
      return_url,
      channels,
      metadata,
      lang,
      invoice_data
    } = req.body;
    
    const userId = req.userId;

    if (!amount) {
      return res.status(400).json({ message: 'Le montant est requis.' });
    }

    if (!customer_phone_number) {
      return res.status(400).json({ message: 'Le numéro de téléphone est requis.' });
    }

    if (!customer_country) {
      return res.status(400).json({ message: 'Le pays est requis.' });
    }

    if (!channels) {
      return res.status(400).json({ message: 'La méthode de paiement est requise.' });
    }

    // Récupérer les informations de l'utilisateur depuis la base de données
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // Vérifier que le pays est XOF
    const allowedCountriesXOF = ['CI', 'SN', 'TG', 'BJ', 'ML', 'BF'];
    if (!allowedCountriesXOF.includes(customer_country)) {
      return res.status(400).json({ message: 'Seuls les pays avec la devise XOF sont acceptés pour le dépôt CinetPay.' });
    }

    try {
      console.log('Données de paiement CinetPay reçues:', {
        transaction_id,
        amount,
        currency,
        customer_country,
        channels,
        customer_phone_number
      });
      
      // Vérification des configurations CinetPay
      if (!config.cinetpay.apiKey || !config.cinetpay.siteId) {
        throw new Error('Configuration CinetPay manquante. Veuillez vérifier CINETPAY_API_KEY et CINETPAY_SITE_ID dans le fichier .env');
      }

      // Préparer les données de paiement selon la documentation CinetPay
      const paymentData = {
        apikey: config.cinetpay.apiKey,
        site_id: parseInt(config.cinetpay.siteId, 10),
        transaction_id: transaction_id,
        amount: parseInt(amount),
        currency: currency || 'XOF',
        alternative_currency: alternative_currency || '',
        description: description || `Rechargement de portefeuille - ${user.username}`,
        customer_id: customer_id || user._id.toString(),
        customer_name: customer_name || user.profile?.firstName || user.username,
        customer_surname: customer_surname || user.profile?.lastName || '',
        customer_email: customer_email || user.email,
        customer_phone_number: customer_phone_number,
        customer_address: customer_address || user.profile?.address || 'Adresse non spécifiée',
        customer_city: customer_city || user.profile?.city || 'Ville non spécifiée',
        customer_country: customer_country,
        customer_state: customer_state || customer_country,
        customer_zip_code: customer_zip_code || '00000',
        notify_url: notify_url || `${config.backendUrl}/api/payments/cinetpay/notification`,
        return_url: return_url || config.cinetpay.callbackUrl,
        channels: channels,
        metadata: metadata || user._id.toString(),
        lang: lang || 'FR',
        invoice_data: invoice_data || {
          user_id: user._id.toString(),
          username: user.username
        }
      };

      console.log('Données envoyées à CinetPay:', JSON.stringify(paymentData, null, 2));

      const response = await axios.post(
        'https://api-checkout.cinetpay.com/v2/payment',
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('Réponse de CinetPay:', response.data);

      if (response.data && (response.data.code === '201' || response.data.code === '200')) {
        // Créer une transaction en attente
        const pendingTransaction = new Transaction({
          userId: user._id,
          amount: parseInt(amount),
          type: 'deposit',
          description: `Rechargement via CinetPay (${channels})`,
          currency: currency || 'XOF',
          status: 'pending',
          metadata: {
            cinetPayId: transaction_id,
            customerPhone: customer_phone_number,
            customerCountry: customer_country,
            paymentMethod: channels
          }
        });
        await pendingTransaction.save();

        res.json({
          transaction_id: transaction_id,
          payment_token: response.data.data.payment_token,
          payment_url: response.data.data.payment_url
        });
      } else {
        throw new Error(response.data.description || 'Réponse invalide de CinetPay');
      }

    } catch (error) {
      console.error('Erreur détaillée lors de la création de la transaction:', error.response?.data || error.message);
      res.status(500).json({ 
        message: 'Échec de l\'initiation du paiement CinetPay',
        error: error.response?.data?.description || error.message 
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'initiation du paiement:', error);
    res.status(500).json({ 
      message: 'Une erreur est survenue',
      error: error.message 
    });
  }
};

exports.handleCinetPayNotification = async (req, res) => {
  try {
    console.log('Notification CinetPay reçue:', req.body);
    
    // Valider la notification
    if (!cinetpayService.validateNotification(req.body)) {
      console.error('Notification CinetPay invalide');
      return res.status(400).send('Notification invalide');
    }

    const { cpm_trans_id } = req.body;

    // Vérifier le statut du paiement
    const response = await cinetpayService.checkPaymentStatus(cpm_trans_id);

    if (response.code === '00') {
      const transaction = await Transaction.findOne({ 'metadata.cinetPayId': cpm_trans_id });
      if (!transaction) {
        console.error('Transaction non trouvée:', cpm_trans_id);
        return res.status(404).send('Transaction non trouvée');
      }

      if (transaction.status === 'completed') {
        return res.status(200).send('Transaction déjà traitée');
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        // Mettre à jour la transaction
        transaction.status = 'completed';
        await transaction.save({ session });

        // Mettre à jour le solde de l'utilisateur
        const user = await User.findById(transaction.userId).session(session);
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        user.solde = (user.solde || 0) + transaction.amount;
        await user.save({ session });
      });

      res.status(200).send('Paiement vérifié avec succès');
    } else {
      // Marquer la transaction comme échouée
      await Transaction.findOneAndUpdate(
        { 'metadata.cinetPayId': cpm_trans_id },
        { status: 'failed' }
      );
      res.status(200).send('Échec de la vérification du paiement');
    }

  } catch (error) {
    console.error('Erreur lors du traitement de la notification:', error);
    res.status(500).send('Erreur interne du serveur');
  }
};

exports.handleCinetPayCallback = async (req, res) => {
  const { transaction_id, status } = req.query;

  if (status === 'ACCEPTED') {
    res.status(200).json({ 
        message: 'Paiement approuvé. Votre solde sera mis à jour sous peu.', 
        status: 'success', 
      transactionId: transaction_id
    });
  } else {
    res.status(400).json({ 
        message: 'Le paiement a échoué ou est en attente.', 
        status: 'failed',
      transactionId: transaction_id
    });
  }
};

exports.getCinetPayStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.userId;

    // Vérifier que la transaction appartient à l'utilisateur
    const transaction = await Transaction.findOne({
      'metadata.cinetPayId': transactionId,
      userId: userId
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction non trouvée' });
    }

    // Vérifier le statut auprès de CinetPay
    const response = await cinetpayService.checkPaymentStatus(transactionId);

    if (response.code === '00') {
      // Si le paiement est confirmé mais la transaction locale n'est pas encore mise à jour
      if (transaction.status === 'pending') {
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
          // Mettre à jour la transaction
          transaction.status = 'completed';
          await transaction.save({ session });

          // Mettre à jour le solde de l'utilisateur
          const user = await User.findById(userId).session(session);
          if (user) {
            user.solde = (user.solde || 0) + transaction.amount;
            await user.save({ session });
          }
        });
      }

      res.json({
        status: 'completed',
        message: 'Paiement confirmé',
        transaction: transaction
      });
    } else {
      res.json({
        status: 'pending',
        message: 'Paiement en attente de confirmation',
        transaction: transaction
      });
    }

  } catch (error) {
    console.error('Erreur lors de la vérification du statut:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la vérification du statut',
      error: error.message 
    });
  }
};

exports.withdrawCinetPay = async (req, res) => {
  try {
    const { amount, country, phoneNumber, paymentMethod } = req.body;
    const userId = req.userId;
    
    if (!amount || !country || !phoneNumber || !paymentMethod) {
      return res.status(400).json({ message: 'Champs requis manquants.' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    
    if (user.solde < amount) {
      return res.status(400).json({ message: 'Solde insuffisant.' });
    }
    
    // Vérifier que le pays est XOF
    const allowedCountriesXOF = ['CI', 'SN', 'TG', 'BJ', 'ML', 'BF'];
    if (!allowedCountriesXOF.includes(country)) {
      return res.status(400).json({ message: 'Seuls les pays avec la devise XOF sont acceptés pour le retrait CinetPay.' });
    }
    
    // Préparer les infos pour CinetPay
    // phoneNumber doit être sans le + (ex: 22956962433)
    let cleanedPhone = phoneNumber.replace(/^\+/, '');
    let prefix = cleanedPhone.substring(0, 3); // ex: 229
    let phone = cleanedPhone.substring(3); // ex: 56962433
    
    const fee = Math.ceil(amount * 0.05); // 5% de frais, arrondi à l'entier supérieur
    const totalDebited = amount + fee;
    // Créer la transaction de retrait en pending
    const transaction = new Transaction({
      userId: userId,
      amount: amount,
      currency: 'XOF',
      type: 'withdrawal',
      status: 'pending',
      description: `Retrait de ${amount} XOF via CinetPay (frais: ${fee} XOF, total débité: ${totalDebited} XOF)`,
      metadata: {
        country,
        phoneNumber,
        paymentMethod,
        provider: 'cinetpay',
        fee,
        totalDebited
      }
    });
    await transaction.save();
    
    try {
      // Appel à l'API payout de CinetPay
      const payoutData = {
        prefix,
        phone,
        amount: Math.floor(amount / 5) * 5, // montant multiple de 5
        name: user.profile?.firstName || user.username,
        surname: user.profile?.lastName || user.profile?.firstName || user.username,
        email: user.email,
        notify_url: `${config.backendUrl}/api/payments/cinetpay/payout-notification`,
        client_transaction_id: transaction._id.toString(),
        payment_method: paymentMethod // optionnel selon la doc
      };
      
      console.log('[Retrait CinetPay] Appel initiatePayout avec:', payoutData);
      
      const payoutResponse = await cinetpayService.initiatePayout(payoutData);
      
      if (payoutResponse && payoutResponse.code === 0) {
        // Mettre à jour la transaction avec l'ID CinetPay
        transaction.metadata.cinetPayId = payoutResponse.transaction_id;
        await transaction.save();
        
        return res.json({
          success: true,
          message: 'Retrait initié avec succès. Votre solde sera déduit une fois le paiement confirmé.',
          data: {
            payoutId: payoutResponse.transaction_id,
            status: payoutResponse.status,
            amount: payoutResponse.amount,
            currency: 'XOF'
          }
        });
      } else {
        // Échec de l'initiation du payout CinetPay
        transaction.status = 'failed';
        await transaction.save();
        
        return res.status(400).json({
          success: false,
          message: 'Échec de l\'initiation du retrait. Votre solde n\'a pas été déduit.',
          error: payoutResponse?.description || 'Réponse invalide de CinetPay'
        });
      }
    } catch (error) {
      // Erreur lors de l'appel à CinetPay
      transaction.status = 'failed';
      await transaction.save();
      
      console.error('Erreur lors du retrait CinetPay:', error);
      console.error('Erreur complète lors du retrait CinetPay:', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message || 'Erreur lors du retrait CinetPay. Votre solde n\'a pas été déduit.' 
      });
    }
  } catch (error) {
    console.error('Erreur lors du retrait CinetPay:', error);
    console.error('Erreur complète lors du retrait CinetPay:', error);
    res.status(500).json({ message: error.message || 'Erreur lors du retrait CinetPay.' });
  }
};

exports.handleCinetPayPayoutNotification = async (req, res) => {
  try {
    console.log('Notification de retrait CinetPay reçue:', req.body);
    
    // Valider la notification de retrait
    if (!cinetpayService.validateNotification(req.body)) {
      console.error('Notification de retrait CinetPay invalide');
      return res.status(400).send('Notification invalide');
    }

    const { cpm_trans_id } = req.body;

    // Vérifier le statut du retrait
    const response = await cinetpayService.checkPayoutStatus(cpm_trans_id);

    if (response.code === '00') {
      const transaction = await Transaction.findOne({ 'metadata.cinetPayId': cpm_trans_id });
      if (!transaction) {
        console.error('Transaction de retrait non trouvée:', cpm_trans_id);
        return res.status(404).send('Transaction non trouvée');
      }

      if (transaction.status === 'completed') {
        return res.status(200).send('Retrait déjà traité');
      }

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        // Mettre à jour la transaction
        transaction.status = 'completed';
        await transaction.save({ session });

        // Déduire le solde de l'utilisateur
        const user = await User.findById(transaction.userId).session(session);
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        user.solde = Math.max(0, (user.solde || 0) - (transaction.metadata.totalDebited || (transaction.amount + (transaction.metadata.fee || Math.ceil(transaction.amount * 0.05)))));
        await user.save({ session });
      });

      res.status(200).send('Retrait vérifié avec succès');
    } else {
      // Marquer la transaction comme échouée
      await Transaction.findOneAndUpdate(
        { 'metadata.cinetPayId': cpm_trans_id },
        { status: 'failed' }
      );
      res.status(200).send('Échec de la vérification du retrait');
    }

  } catch (error) {
    console.error('Erreur lors du traitement de la notification de retrait:', error);
    res.status(500).send('Erreur interne du serveur');
  }
}; 