const mongoose = require('mongoose');
const config = require('./src/config/config');

// Connexion à MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Modèle Transaction
const Transaction = require('./src/models/transaction.model');

async function checkTransactions() {
  try {
    console.log('🔍 Vérification des transactions en base de données...\n');
    
    // Récupérer toutes les transactions Moneroo
    const transactions = await Transaction.find({
      'metadata.monerooId': { $exists: true }
    }).sort({ createdAt: -1 }).limit(10);
    
    console.log(`📊 ${transactions.length} transactions Moneroo trouvées:\n`);
    
    if (transactions.length === 0) {
      console.log('❌ Aucune transaction Moneroo trouvée en base de données');
      console.log('💡 Créez d\'abord une transaction via l\'interface utilisateur');
      return;
    }
    
    transactions.forEach((transaction, index) => {
      console.log(`${index + 1}. Transaction ID: ${transaction._id}`);
      console.log(`   - Moneroo ID: ${transaction.metadata.monerooId}`);
      console.log(`   - Statut: ${transaction.status}`);
      console.log(`   - Montant: ${transaction.amount} ${transaction.currency}`);
      console.log(`   - Type: ${transaction.type}`);
      console.log(`   - Description: ${transaction.description}`);
      console.log(`   - Créée le: ${transaction.createdAt}`);
      console.log(`   - Méthode: ${transaction.metadata.paymentMethod || 'N/A'}`);
      console.log('');
    });
    
    // Afficher les IDs pour les tests
    console.log('🧪 IDs pour les tests de callback:');
    console.log('```javascript');
    transactions.slice(0, 3).forEach((transaction, index) => {
      console.log(`// Test ${index + 1}: ${transaction.status} - ${transaction.amount} ${transaction.currency}`);
      console.log(`transaction_id: '${transaction.metadata.monerooId}',`);
      console.log(`status: '${transaction.status === 'completed' ? 'success' : transaction.status}',`);
      console.log(`amount: '${transaction.amount}',`);
      console.log(`currency: '${transaction.currency}',`);
      console.log(`payment_method: '${transaction.metadata.paymentMethod || 'mtn_bj'}'`);
      console.log('');
    });
    console.log('```');
    
    // Vérifier les transactions sans monerooId
    const transactionsWithoutMonerooId = await Transaction.find({
      'metadata.monerooId': { $exists: false },
      type: 'deposit'
    }).sort({ createdAt: -1 }).limit(5);
    
    if (transactionsWithoutMonerooId.length > 0) {
      console.log(`⚠️ ${transactionsWithoutMonerooId.length} transactions sans monerooId trouvées:`);
      transactionsWithoutMonerooId.forEach((transaction, index) => {
        console.log(`   ${index + 1}. ${transaction._id} - ${transaction.status} - ${transaction.amount} ${transaction.currency}`);
      });
      console.log('');
    }
    
    // Marquer comme échouées les transactions en attente depuis plus de 75h
    const now = new Date();
    const seventyFiveHoursAgo = new Date(now.getTime() - 75 * 60 * 60 * 1000);
    const expired = await Transaction.updateMany(
      {
        status: 'pending',
        createdAt: { $lte: seventyFiveHoursAgo }
      },
      { $set: { status: 'failed' } }
    );
    if (expired.modifiedCount > 0) {
      console.log(`🚨 ${expired.modifiedCount} transaction(s) en attente depuis plus de 75h ont été passées en échec.`);
    } else {
      console.log('✅ Aucune transaction en attente depuis plus de 75h.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Exécuter la vérification
checkTransactions(); 