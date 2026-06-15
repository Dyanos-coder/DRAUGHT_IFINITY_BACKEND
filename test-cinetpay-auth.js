const axios = require('axios');
const qs = require('querystring');

// Configuration CinetPay
const config = {
  cinetpay: {
    apiKey: '778574534683886413e3352.77859318',
    apiPassword: 'SA101010@', // Ceci doit être le vrai mot de passe
    siteId: '105896683'
  }
};

async function testCinetPayAuth() {
  console.log('🔍 Test d\'authentification CinetPay...');
  
  // Afficher les informations de configuration
  console.log('\n📋 Configuration CinetPay:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔑 API Key: ${config.cinetpay.apiKey}`);
  console.log(`🔐 API Password: ${config.cinetpay.apiPassword}`);
  console.log(`🏢 Site ID: ${config.cinetpay.siteId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Test 1: Authentification avec apikey seulement
    console.log('\n📝 Test 1: Authentification avec apikey seulement');
    const url1 = 'https://client.cinetpay.com/v1/auth/login';
    const data1 = qs.stringify({
      apikey: config.cinetpay.apiKey
    });
    
    try {
      const response1 = await axios.post(url1, data1, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      console.log('✅ Réponse avec apikey seulement:', response1.data);
    } catch (error1) {
      console.log('❌ Erreur avec apikey seulement:', error1.response?.data || error1.message);
    }

    // Test 2: Authentification avec apikey + password
    console.log('\n📝 Test 2: Authentification avec apikey + password');
    const data2 = qs.stringify({
      apikey: config.cinetpay.apiKey,
      password: config.cinetpay.apiPassword
    });
    
    try {
      const response2 = await axios.post(url1, data2, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      console.log('✅ Réponse avec apikey + password:', response2.data);
    } catch (error2) {
      console.log('❌ Erreur avec apikey + password:', error2.response?.data || error2.message);
    }

    // Test 3: Authentification avec site_id + apikey
    console.log('\n📝 Test 3: Authentification avec site_id + apikey');
    const data3 = qs.stringify({
      site_id: config.cinetpay.siteId,
      apikey: config.cinetpay.apiKey
    });
    
    try {
      const response3 = await axios.post(url1, data3, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      console.log('✅ Réponse avec site_id + apikey:', response3.data);
    } catch (error3) {
      console.log('❌ Erreur avec site_id + apikey:', error3.response?.data || error3.message);
    }

    // Test 4: Authentification avec tous les paramètres
    console.log('\n📝 Test 4: Authentification avec tous les paramètres');
    const data4 = qs.stringify({
      site_id: config.cinetpay.siteId,
      apikey: config.cinetpay.apiKey,
      password: config.cinetpay.apiPassword
    });
    
    try {
      const response4 = await axios.post(url1, data4, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      console.log('✅ Réponse avec tous les paramètres:', response4.data);
    } catch (error4) {
      console.log('❌ Erreur avec tous les paramètres:', error4.response?.data || error4.message);
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
}

// Exécuter le test
testCinetPayAuth(); 