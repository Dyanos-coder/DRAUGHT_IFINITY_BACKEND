const axios = require('axios');
const config = require('../config/config');
const qs = require('qs');

class CinetPayService {
  constructor() {
    this.apiKey = config.cinetpay.apiKey;
    this.siteId = config.cinetpay.siteId;
    this.baseUrl = 'https://api-checkout.cinetpay.com/v2';
  }

  /**
   * Initie une transaction de paiement
   * @param {Object} paymentData - Données du paiement
   * @returns {Promise<Object>} - Réponse de CinetPay
   */
  async initiatePayment(paymentData) {
    try {
      const data = {
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: paymentData.transactionId,
        amount: parseInt(paymentData.amount),
        currency: paymentData.currency || 'XOF',
        description: paymentData.description,
        channels:  'ALL',
        notify_url: paymentData.notifyUrl,
        return_url: paymentData.returnUrl,
        lang: paymentData.lang || 'fr',
        metadata: paymentData.metadata ? JSON.stringify(paymentData.metadata) : '',
        customer_name: paymentData.customerName,
        customer_surname: paymentData.customerSurname,
        customer_email: paymentData.customerEmail,
        customer_phone_number: paymentData.customerPhone,
        customer_address: paymentData.customerAddress,
        customer_city: paymentData.customerCity,
        customer_country: paymentData.customerCountry || 'BJ',
        customer_state: paymentData.customerState || 'BJ',
        customer_zip_code: paymentData.customerZipCode || '229'
      };

      console.log('Données envoyées à CinetPay:', JSON.stringify(data, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/payment`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('Réponse de CinetPay:', response.data);
      return response.data;

    } catch (error) {
      console.error('Erreur lors de l\'initiation du paiement CinetPay:', error.response?.data || error.message);
      throw new Error(error.response?.data?.description || error.message);
    }
  }

  /**
   * Vérifie le statut d'une transaction
   * @param {string} transactionId - ID de la transaction
   * @returns {Promise<Object>} - Statut de la transaction
   */
  async checkTransactionStatus(transactionId) {
    try {
      const response = await axios.post(`${this.baseUrl}/payment/check`, {
        apikey: this.apiKey,
        site_id: parseInt(this.siteId, 10),
        transaction_id: transactionId
      });

      return response.data;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtenir l'historique des transactions
   * @param {string} startDate - Date de début
   * @param {string} endDate - Date de fin
   * @returns {Promise<Object>} - Historique des transactions
   */
  async getTransactionHistory(startDate, endDate) {
    try {
      const response = await axios.post(`${this.baseUrl}/payment/check`, {
        apikey: this.apiKey,
        site_id: parseInt(this.siteId, 10),
        start_date: startDate,
        end_date: endDate
      });

      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Valide une notification de paiement
   * @param {Object} notificationData - Données de la notification
   * @returns {boolean} - True si la notification est valide
   */
  validateNotification(notificationData) {
    // Vérifier les champs requis
    const requiredFields = ['cpm_trans_id', 'cpm_amount', 'cpm_currency'];
    
    for (const field of requiredFields) {
      if (!notificationData[field]) {
        console.error(`Champ requis manquant: ${field}`);
        return false;
      }
    }

    // Vérifier que le montant correspond
    if (parseInt(notificationData.cpm_amount) <= 0) {
      console.error('Montant invalide dans la notification');
      return false;
    }

    return true;
  }

  /**
   * Formate les données client pour CinetPay
   * @param {Object} user - Données utilisateur
   * @param {string} phoneNumber - Numéro de téléphone
   * @returns {Object} - Données client formatées
   */
  formatCustomerData(user, phoneNumber) {
    return {
      customer_name: user.profile?.firstName || user.username,
      customer_surname: user.profile?.lastName || '',
      customer_email: user.email || 'client@example.com',
      customer_phone_number: phoneNumber,
      customer_address: user.profile?.address || 'Cotonou',
      customer_city: user.profile?.city || 'Cotonou',
      customer_country: 'BJ',
      customer_state: 'BJ',
      customer_zip_code: '229'
    };
  }

  /**
   * Valide les données de paiement
   * @param {Object} paymentData - Données du paiement
   * @returns {boolean} - True si les données sont valides
   */
  validatePaymentData(paymentData) {
    const requiredFields = ['amount', 'currency', 'customer_phone_number', 'customer_country', 'channels'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Champs manquants: ${missingFields.join(', ')}`);
    }

    // Valider le montant
    const amount = parseInt(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Le montant doit être un nombre positif');
    }

    // Valider le numéro de téléphone
    if (!paymentData.customer_phone_number.match(/^\+[1-9]\d{1,14}$/)) {
      throw new Error('Le numéro de téléphone doit être au format international (+225004315545)');
    }

    return true;
  }

  async getTransferToken() {
    const url = 'https://client.cinetpay.com/v1/auth/login';
    const data = qs.stringify({
      apikey: config.cinetpay.apiKey,
      password: config.cinetpay.apiPassword
    });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const response = await axios.post(url, data, { headers });
    if (response.data.code !== 0) throw new Error('Erreur auth CinetPay: ' + response.data.message);
    return response.data.data.token;
  }

  async addContact({ prefix, phone, name, surname, email }, token) {
    const url = `https://client.cinetpay.com/v1/transfer/contact?token=${token}&lang=fr`;
    const data = qs.stringify({
      data: JSON.stringify([{ prefix, phone, name, surname, email }])
    });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const response = await axios.post(url, data, { headers });
    if (response.data.code !== 0) {
      console.error('Erreur ajout contact CinetPay:', JSON.stringify(response.data, null, 2));
      if (response.data.data) {
        try {
          console.error('Détail erreur CinetPay:', JSON.stringify(response.data.data, null, 2));
        } catch (e) {
          console.error('Détail erreur CinetPay (brut):', response.data.data);
        }
        console.error('Détail erreur CinetPay (brut):', response.data.data);
        console.error('Type de data:', typeof response.data.data, Array.isArray(response.data.data));
        if (Array.isArray(response.data.data)) {
          for (const err of response.data.data) {
            console.error('Erreur CinetPay (élément):', JSON.stringify(err, null, 2));
          }
        }
      }
      throw new Error('Erreur ajout contact: ' + response.data.message);
    }
    return response.data.data[0];
  }

  async sendMoney({ prefix, phone, amount, notify_url, client_transaction_id, payment_method }, token) {
    console.log('Appel sendMoney CinetPay', { prefix, phone, amount, notify_url, client_transaction_id, payment_method, token });
    const url = `https://client.cinetpay.com/v1/transfer/money/send/contact?token=${token}&lang=fr`;
    const data = qs.stringify({
      data: JSON.stringify([{
        prefix,
        phone,
        amount,
        notify_url,
        client_transaction_id,
        payment_method
      }])
    });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    try {
      const response = await axios.post(url, data, { headers });
      console.log('Réponse complète CinetPay:', response.data);
      if (response.data.code !== 0) {
        throw new Error('Erreur transfert: ' + response.data.message);
      }
      return response.data.data[0];
    } catch (error) {
      if (error.response) {
        console.error('Erreur réseau CinetPay:', error.response.data);
      } else {
        console.error('Erreur axios CinetPay:', error.message);
      }
      throw error;
    }
  }

  async initiatePayout(payoutData) {
    // 1. Auth
    const token = await this.getTransferToken();
    // 2. Add contact
    await this.addContact({
      prefix: payoutData.prefix,
      phone: payoutData.phone,
      name: payoutData.name,
      surname: payoutData.surname,
      email: payoutData.email
    }, token);
    // 3. Send money
    console.log('Payload envoyé à CinetPay:', JSON.stringify({
      prefix: payoutData.prefix,
      phone: payoutData.phone,
      amount: payoutData.amount,
      notify_url: payoutData.notify_url,
      client_transaction_id: payoutData.client_transaction_id,
      payment_method: payoutData.payment_method
    }, null, 2));
    try {
      const transfer = await this.sendMoney({
        prefix: payoutData.prefix,
        phone: payoutData.phone,
        amount: payoutData.amount,
        notify_url: payoutData.notify_url,
        client_transaction_id: payoutData.client_transaction_id,
        payment_method: payoutData.payment_method
      }, token);
      return transfer;
    } catch (error) {
      if (error.response) {
        console.error('Erreur complète:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Erreur axios CinetPay:', error.message);
      }
      throw error;
    }
  }

  /**
   * Vérifie le statut d'un retrait
   * @param {string} transactionId - ID de la transaction de retrait
   * @returns {Promise<Object>} - Statut du retrait
   */
  async checkPayoutStatus(transactionId) {
    try {
      const response = await axios.post(`${this.baseUrl}/payout/check`, {
        apikey: this.apiKey,
        site_id: parseInt(this.siteId, 10),
        transaction_id: transactionId
      });

      return response.data;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut de retrait:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new CinetPayService(); 