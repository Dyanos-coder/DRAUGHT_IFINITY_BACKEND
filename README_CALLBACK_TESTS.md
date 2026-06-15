# 🧪 Tests de Callback Moneroo

Ce dossier contient des scripts pour tester les callbacks de paiement Moneroo.

## 📁 Fichiers de Test

### 1. `test-moneroo-callback.js`
**Test avec transactions fictives** - Utilise des IDs de transaction qui n'existent pas en base de données.

### 2. `test-real-transaction.js` ⭐ **NOUVEAU**
**Test avec vraie transaction** - Crée une vraie transaction et teste les callbacks.

### 3. `test-simple-callback.js`
**Test simple** - Version simplifiée pour tests rapides.

### 4. `test-callback-curl.sh`
**Test avec cURL** - Script bash pour tests manuels.

## 🚀 Comment Exécuter

### Test avec Transactions Fictives
```bash
cd Backend_ASC-main
node test-moneroo-callback.js
```

### Test avec Vraie Transaction ⭐
```bash
cd Backend_ASC-main
export TEST_TOKEN="your_jwt_token_here"
node test-real-transaction.js
```

### Test Simple
```bash
cd Backend_ASC-main
node test-simple-callback.js
```

### Test avec cURL
```bash
cd Backend_ASC-main
chmod +x test-callback-curl.sh
./test-callback-curl.sh
```

## 📊 Interprétation des Résultats

### ✅ **Comportement Normal (Transactions Fictives)**
```
❌ Redirection incorrecte
   Attendu: http://localhost:5173/wallet?status=success&message=Paiement traité avec succès
   Reçu: http://localhost:5173/wallet?status=error&message=Transaction non trouvée
```
**Ceci est NORMAL** car les IDs de test n'existent pas en base de données.

### ✅ **Comportement Normal (Vraie Transaction)**
```
✅ Redirection correcte vers le frontend
```
**Ceci indique que le système fonctionne correctement.**

## 🔧 Configuration

### Variables d'Environnement
```bash
# Pour les tests avec vraie transaction
export TEST_TOKEN="your_jwt_token_here"

# URLs (optionnel, valeurs par défaut dans config.js)
export BACKEND_URL="http://localhost:5000"
export FRONTEND_URL="http://localhost:5173"
```

### Obtenir un Token de Test
1. Connectez-vous à votre application
2. Ouvrez les DevTools (F12)
3. Allez dans l'onglet Application/Storage
4. Copiez le token JWT depuis localStorage
5. Configurez-le comme variable d'environnement

## 🎯 Scénarios de Test

### 1. **Transactions Fictives** (`test-moneroo-callback.js`)
- ✅ Teste la gestion d'erreur "Transaction non trouvée"
- ✅ Vérifie que le backend redirige correctement vers le frontend
- ✅ Teste différents statuts (success, failed, pending)
- ✅ Teste les cas d'erreur (ID manquant, statut invalide)

### 2. **Vraie Transaction** (`test-real-transaction.js`)
- ✅ Crée une vraie transaction en base de données
- ✅ Teste les callbacks avec une transaction existante
- ✅ Vérifie que le solde utilisateur est mis à jour
- ⚠️ **Attention** : Peut affecter le solde utilisateur

## 🔍 Diagnostic des Problèmes

### Problème : "Transaction non trouvée" pour vraie transaction
**Causes possibles :**
1. Token invalide ou expiré
2. Transaction non créée correctement
3. Délai de synchronisation insuffisant
4. Problème de base de données

**Solutions :**
1. Vérifiez que le token est valide
2. Augmentez le délai d'attente (ligne 89 dans `test-real-transaction.js`)
3. Vérifiez les logs du backend
4. Testez manuellement la création de transaction

### Problème : URL de redirection incorrecte
**Causes possibles :**
1. Configuration frontend URL incorrecte
2. Problème de CORS
3. Serveur backend non démarré

**Solutions :**
1. Vérifiez `config.frontendUrl` dans `config.js`
2. Assurez-vous que le backend est démarré
3. Vérifiez les logs CORS

## 📝 Logs Utiles

### Backend Logs
```bash
# Démarrer le backend en mode debug
DEBUG=* npm start
```

### Vérifier les Transactions
```javascript
// Dans la console MongoDB
db.transactions.find({}).sort({createdAt: -1}).limit(5)
```

## 🎉 Résultats Attendus

### Test Réussi
```
🧪 Test: SUCCESS avec vraie transaction
📤 URL: http://localhost:5000/api/payments/moneroo/callback
📋 Paramètres: { transaction_id: 'real_id_123', status: 'success', ... }
✅ Réponse: 302
🔄 Redirection: http://localhost:5173/wallet?status=success&message=Paiement traité avec succès
✅ Redirection correcte vers le frontend
```

### Test d'Erreur (Normal pour transactions fictives)
```
🧪 Test: Paiement réussi
📤 Envoi vers: http://localhost:5000/api/payments/moneroo/callback
📋 Paramètres: { transaction_id: 'test_success_123', ... }
✅ Réponse reçue:
   - Status: 302
   - Redirection vers: http://localhost:5173/wallet?status=error&message=Transaction non trouvée
✅ Redirection correcte (erreur attendue pour transaction fictive)
```

## 🔒 Sécurité

- ⚠️ **Ne jamais** utiliser de vrais tokens en production
- ⚠️ **Ne jamais** tester avec de vrais montants
- ✅ Utilisez toujours un environnement de test
- ✅ Vérifiez les permissions utilisateur avant les tests 
4. Vérifiez la configuration des variables d'environnement 