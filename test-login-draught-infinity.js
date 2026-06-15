const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Test de connexion pour "Draught Infinity"...\n');
    
    const loginData = {
      email: 'jean@gmail.com',
      password: 'votre_mot_de_passe', // ⚠️ REMPLACEZ PAR LE VRAI MOT DE PASSE
      gameName: 'draught infinity'
    };

    console.log('📤 Envoi de la requête de login:');
    console.log(JSON.stringify(loginData, null, 2));
    console.log('\n');

    const response = await axios.post('http://localhost:3001/api/auth/login', loginData);

    console.log('✅ Réponse du serveur:');
    console.log('Status:', response.status);
    console.log('\n📦 Données reçues:');
    console.log(JSON.stringify(response.data, null, 2));

    // Vérifier spécifiquement les champs soldePiece et soldeEnergie
    console.log('\n\n🔍 ANALYSE DES CHAMPS IMPORTANTS:');
    console.log('=' .repeat(60));
    
    if (response.data.player) {
      console.log('✅ Objet player présent');
      console.log(`   - soldePiece: ${response.data.player.soldePiece !== undefined ? response.data.player.soldePiece : '❌ ABSENT'}`);
      console.log(`   - soldeEnergie: ${response.data.player.soldeEnergie !== undefined ? response.data.player.soldeEnergie : '❌ ABSENT'}`);
      console.log(`   - inGameUsername: ${response.data.player.inGameUsername || 'N/A'}`);
      console.log(`   - level: ${response.data.player.level || 'N/A'}`);
      console.log(`   - wins: ${response.data.player.wins || 'N/A'}`);
      console.log(`   - losses: ${response.data.player.losses || 'N/A'}`);
    } else {
      console.log('❌ Objet player ABSENT dans la réponse');
    }

    if (response.data.token) {
      console.log('\n✅ Token JWT présent');
      console.log(`   Token: ${response.data.token.substring(0, 50)}...`);
    } else {
      console.log('\n❌ Token JWT ABSENT');
    }

    // Test de l'endpoint /api/auth/me
    console.log('\n\n🔄 Test de l\'endpoint /api/auth/me...');
    const meResponse = await axios.get('http://localhost:3001/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });

    console.log('✅ Réponse de /api/auth/me:');
    console.log(JSON.stringify(meResponse.data, null, 2));

    console.log('\n\n🔍 ANALYSE /api/auth/me:');
    console.log('=' .repeat(60));
    if (meResponse.data.player) {
      console.log('✅ Objet player présent');
      console.log(`   - soldePiece: ${meResponse.data.player.soldePiece !== undefined ? meResponse.data.player.soldePiece : '❌ ABSENT'}`);
      console.log(`   - soldeEnergie: ${meResponse.data.player.soldeEnergie !== undefined ? meResponse.data.player.soldeEnergie : '❌ ABSENT'}`);
    } else {
      console.log('❌ Objet player ABSENT');
    }

    console.log('\n\n💡 DIAGNOSTIC:');
    console.log('=' .repeat(60));
    
    const loginHasFields = response.data.player?.soldePiece !== undefined && response.data.player?.soldeEnergie !== undefined;
    const meHasFields = meResponse.data.player?.soldePiece !== undefined && meResponse.data.player?.soldeEnergie !== undefined;

    if (loginHasFields && meHasFields) {
      console.log('✅ Le backend renvoie bien les champs soldePiece et soldeEnergie');
      console.log('⚠️  Le problème vient probablement de l\'app mobile Flutter');
      console.log('\n📱 VÉRIFICATIONS À FAIRE DANS L\'APP MOBILE:');
      console.log('   1. Vérifier que l\'app mobile utilise bien le gameName: "draught infinity"');
      console.log('   2. Vérifier les logs de l\'app mobile (console Flutter)');
      console.log('   3. Vérifier que l\'app extrait bien response[\'player\'][\'soldePiece\']');
      console.log('   4. Rebuild l\'app mobile: flutter clean && flutter pub get');
    } else {
      console.log('❌ Le backend ne renvoie PAS les champs soldePiece et soldeEnergie');
      console.log('🔧 CORRECTION NÉCESSAIRE DANS LE BACKEND:');
      if (!loginHasFields) {
        console.log('   - Fichier: src/controllers/auth.controller.js (fonction login)');
      }
      if (!meHasFields) {
        console.log('   - Fichier: src/controllers/auth.controller.js (fonction getCurrentUser)');
      }
    }

  } catch (error) {
    console.error('\n❌ ERREUR lors du test:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data);
    } else if (error.request) {
      console.error('⚠️  Pas de réponse du serveur. Le backend est-il démarré?');
      console.error('   Démarrez le backend avec: cd Arena_back && pnpm run dev');
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

console.log('⚠️  INSTRUCTIONS:');
console.log('1. Assurez-vous que le backend est démarré (pnpm run dev)');
console.log('2. Modifiez le mot de passe dans ce fichier (ligne 8)');
console.log('3. Exécutez: node test-login-draught-infinity.js\n');
console.log('=' .repeat(60));
console.log('\n');

testLogin();
