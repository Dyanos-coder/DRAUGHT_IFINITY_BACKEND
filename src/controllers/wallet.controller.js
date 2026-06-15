const User = require('../models/user.model');
const SiteConfig = require('../models/siteConfig.model');
const Transaction = require('../models/transaction.model');
const axios = require('axios');

/**
 * Initier une recharge ARN via MoneyFusion
 */
exports.rechargeArn = async (req, res) => {
  try {
    const { arnAmount, currency, totalAmount } = req.body;
    const userId = req.userId;

    // Validation
    if (!arnAmount || arnAmount < 100) {
      return res.status(400).json({
        success: false,
        message: "Le montant minimum est de 100 ARN"
      });
    }

    if (!currency || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Devise et montant total requis"
      });
    }

    // Récupérer la configuration du site
    const config = await SiteConfig.getConfig();
    
    // Vérifier que MoneyFusion est configuré
    if (!config.moneyFusion.apiUrl || config.moneyFusion.apiUrl.trim() === '') {
      return res.status(500).json({
        success: false,
        message: "MoneyFusion n'est pas configuré. Veuillez configurer l'URL API dans les paramètres du site (Admin > Configuration)."
      });
    }
    
    // Vérifier le prix de l'ARN pour cette devise
    const arnPrice = config.arnPrices[currency];
    
    if (!arnPrice) {
      return res.status(400).json({
        success: false,
        message: `Devise ${currency} non supportée`
      });
    }

    // Vérifier le calcul du total avec une tolérance de 1%
    const expectedTotal = arnAmount * arnPrice;
    const tolerance = expectedTotal * 0.01; // 1% de tolérance
    if (Math.abs(expectedTotal - totalAmount) > tolerance) {
      return res.status(400).json({
        success: false,
        message: `Erreur de calcul du montant total. Attendu: ${expectedTotal.toFixed(2)}, Reçu: ${totalAmount}`
      });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Créer une transaction en attente
    const transaction = new Transaction({
      userId: userId,
      type: 'recharge_arn',
      amount: totalAmount,
      currency: currency,
      arnAmount: arnAmount,
      status: 'pending',
      paymentMethod: 'moneyfusion',
      description: `Recharge de ${arnAmount} ARN`,
      metadata: {
        arnAmount,
        arnPrice,
        currency
      }
    });

    await transaction.save();

    // Préparer la requête MoneyFusion selon leur documentation
    // Voir: https://docs.moneyfusion.net/en/webapi
    const moneyFusionData = {
      totalPrice: totalAmount,
      article: [{
        [`Recharge ${arnAmount} ARN`]: totalAmount
      }],
      personal_Info: [{
        userId: userId.toString(),
        transactionId: transaction._id.toString(),
        arnAmount: arnAmount,
        currency: currency
      }],
      numeroSend: user.phoneNumber || "00000000", // Numéro de téléphone du client
      nomclient: user.username || user.email,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?payment=success&tx=${transaction._id}`,
      webhook_url: `${process.env.API_URL || 'http://localhost:3000'}/api/wallet/moneyfusion-callback`
    };

    console.log('📤 Envoi requête MoneyFusion:', {
      url: config.moneyFusion.apiUrl,
      data: moneyFusionData
    });

    // Appeler l'API MoneyFusion
    // L'API URL contient déjà la clé API selon la documentation
    const moneyFusionResponse = await axios.post(
      config.moneyFusion.apiUrl,
      moneyFusionData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📥 Réponse MoneyFusion:', moneyFusionResponse.data);

    // Selon la doc, la réponse contient: { statut, token, message, url }
    if (moneyFusionResponse.data && moneyFusionResponse.data.statut && moneyFusionResponse.data.url) {
      // Mettre à jour la transaction avec le token MoneyFusion
      transaction.metadata.moneyFusionToken = moneyFusionResponse.data.token;
      transaction.metadata.moneyFusionMessage = moneyFusionResponse.data.message;
      await transaction.save();

      return res.json({
        success: true,
        message: moneyFusionResponse.data.message || "Transaction initiée",
        paymentUrl: moneyFusionResponse.data.url,
        transactionId: transaction._id,
        token: moneyFusionResponse.data.token
      });
    } else {
      transaction.status = 'failed';
      transaction.metadata.error = moneyFusionResponse.data?.message || 'Invalid response from MoneyFusion';
      await transaction.save();

      return res.status(500).json({
        success: false,
        message: moneyFusionResponse.data?.message || "Erreur lors de l'initialisation du paiement"
      });
    }

  } catch (error) {
    console.error('Erreur recharge ARN:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de la recharge"
    });
  }
};

/**
 * Callback MoneyFusion pour confirmer le paiement
 * Webhook documentation: https://docs.moneyfusion.net/en/webapi#real-time-transaction-monitoring-via-webhook
 */
exports.moneyFusionCallback = async (req, res) => {
  try {
    console.log('📞 MoneyFusion webhook reçu:', req.body);

    const { 
      event, 
      tokenPay, 
      personal_Info, 
      Montant, 
      statut,
      numeroTransaction 
    } = req.body;

    // Extraire l'ID de transaction de personal_Info
    if (!personal_Info || !personal_Info[0] || !personal_Info[0].transactionId) {
      console.error('❌ Personal info manquant dans le webhook');
      return res.status(400).json({
        success: false,
        message: "Personal info manquant"
      });
    }

    const transactionId = personal_Info[0].transactionId;
    const arnAmount = personal_Info[0].arnAmount;

    // Trouver la transaction
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      console.error('❌ Transaction non trouvée:', transactionId);
      return res.status(404).json({
        success: false,
        message: "Transaction non trouvée"
      });
    }

    console.log(`📊 Transaction trouvée, statut actuel: ${transaction.status}, event: ${event}`);

    // Éviter de traiter plusieurs fois le même événement
    if (transaction.status === 'completed' && event === 'payin.session.completed') {
      console.log('✅ Transaction déjà complétée, webhook ignoré');
      return res.json({
        success: true,
        message: "Déjà traité"
      });
    }

    // Gérer les différents événements
    switch (event) {
      case 'payin.session.pending':
        console.log('⏳ Paiement en cours...');
        transaction.status = 'pending';
        transaction.metadata.moneyFusionToken = tokenPay;
        await transaction.save();
        
        return res.json({
          success: true,
          message: "Statut mis à jour: en cours"
        });

      case 'payin.session.completed':
        console.log('✅ Paiement complété!');
        
        // Vérifier le montant
        if (transaction.amount !== Montant) {
          console.error('❌ Montants ne correspondent pas:', {
            expected: transaction.amount,
            received: Montant
          });
          transaction.status = 'failed';
          transaction.metadata.error = 'Amount mismatch';
          await transaction.save();
          
          return res.status(400).json({
            success: false,
            message: "Les montants ne correspondent pas"
          });
        }

        // Créditer le compte de l'utilisateur
        const user = await User.findById(transaction.userId);
        if (!user) {
          console.error('❌ Utilisateur non trouvé:', transaction.userId);
          return res.status(404).json({
            success: false,
            message: "Utilisateur non trouvé"
          });
        }

        // Ajouter les ARN
        const previousBalance = user.arnBalance || 0;
        user.arnBalance = previousBalance + arnAmount;
        await user.save();

        console.log(`💰 ARN crédités: ${previousBalance} + ${arnAmount} = ${user.arnBalance}`);

        // Mettre à jour la transaction
        transaction.status = 'completed';
        transaction.metadata.moneyFusionToken = tokenPay;
        transaction.metadata.numeroTransaction = numeroTransaction;
        transaction.metadata.completedAt = new Date();
        await transaction.save();

        return res.json({
          success: true,
          message: "Paiement confirmé et ARN crédités"
        });

      case 'payin.session.cancelled':
        console.log('❌ Paiement annulé/échoué');
        transaction.status = 'failed';
        transaction.metadata.moneyFusionToken = tokenPay;
        transaction.metadata.error = 'Payment cancelled or failed';
        await transaction.save();

        return res.json({
          success: true,
          message: "Paiement annulé"
        });

      default:
        console.log('⚠️ Événement inconnu:', event);
        return res.json({
          success: true,
          message: "Événement reçu"
        });
    }

  } catch (error) {
    console.error('❌ Erreur callback MoneyFusion:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors du traitement du callback"
    });
  }
};

/**
 * Obtenir l'historique des recharges ARN
 */
exports.getArnRechargeHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    const transactions = await Transaction.find({
      userId: userId,
      type: 'recharge_arn'
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

    const count = await Transaction.countDocuments({
      userId: userId,
      type: 'recharge_arn'
    });

    return res.json({
      success: true,
      transactions,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });

  } catch (error) {
    console.error('Erreur historique recharges ARN:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de la récupération de l'historique"
    });
  }
};
