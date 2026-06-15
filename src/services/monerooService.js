const { initiatePayment, checkTransactionStatus, PaymentMethod, Payout } = require('moneroo-nodejs-sdk');
const config = require('../config/config');
const axios = require('axios');

class MonerooService {
  constructor() {
    this.apiKey = config.moneroo.apiKey;
    this.publicKey = config.moneroo.publicKey;
    this.secretKey = config.moneroo.secretKey;
  }

  async initiatePayment(paymentData) {
    try {
      const paymentParams = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'XOF',
        description: paymentData.description,
        email: paymentData.email,
        firstName: paymentData.firstName,
        lastName: paymentData.lastName,
        returnUrl: `${process.env.BACKEND_URL || config.backendUrl}/api/payments/moneroo/callback`,
        methods: paymentData.methods || [
          PaymentMethod.MtnBJ,
          PaymentMethod.MoovBJ,
          PaymentMethod.OrangeBJ,
          PaymentMethod.CardXOF
        ]
      };

      console.log('Payment parameters:', paymentParams);
      const result = await initiatePayment(paymentParams, this.apiKey);
      return result;
    } catch (error) {
      console.error('Moneroo payment initiation error:', error);
      throw error;
    }
  }

  async checkTransactionStatus(transactionId) {
    try {
      const status = await checkTransactionStatus(transactionId, this.apiKey);
      return status;
    } catch (error) {
      console.error('Moneroo transaction status check error:', error);
      throw error;
    }
  }

  async payout(payoutData) {
    try {
      const monerooPayout = new Payout(this.publicKey, this.secretKey);
      const result = await monerooPayout.init(payoutData);
      return result;
    } catch (error) {
      console.error('Moneroo payout error:', error);
      throw error;
    }
  }

  async payoutDirect(payoutData) {
    try {
      console.log('[Moneroo payoutDirect] Payload envoyé à Moneroo:', JSON.stringify(payoutData, null, 2));
      console.log('[Moneroo payoutDirect] Clé secrète utilisée:', this.secretKey);
      const response = await axios.post(
        'https://api.moneroo.io/v1/payouts/initialize',
        payoutData,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('[Moneroo payoutDirect] Réponse Moneroo:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Erreur payout Moneroo:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new MonerooService(); 