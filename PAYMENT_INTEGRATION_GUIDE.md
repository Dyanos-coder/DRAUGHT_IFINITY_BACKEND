# Guide d'Intégration des Paiements - AfrikSoccerCup

## Vue d'ensemble

Ce guide décrit l'intégration complète des systèmes de paiement CinetPay et Moneroo dans l'application AfrikSoccerCup, permettant aux utilisateurs de recharger leur portefeuille via différentes méthodes selon leur localisation.

## Architecture des Paiements

### Fournisseurs de Paiement

#### 1. CinetPay
- **Pays cible** : Bénin
- **Opérateurs supportés** : MTN, Moov, Orange
- **Devise** : XOF (Franc CFA)
- **Type** : Paiement mobile local

#### 2. Moneroo
- **Pays cible** : International (Afrique)
- **Opérateurs supportés** : Multiples opérateurs par pays
- **Devises** : XOF, USD, EUR, etc.
- **Type** : Paiement mobile international

## Interface Utilisateur

### Flux de Rechargement

1. **Étape 1** : L'utilisateur clique sur "Recharger"
2. **Étape 2** : Choix du fournisseur de paiement
   - CinetPay (Bénin)
   - Moneroo (International)
3. **Étape 3** : Formulaire spécifique au fournisseur choisi
4. **Étape 4** : Redirection vers la page de paiement
5. **Étape 5** : Retour et confirmation

### Formulaires par Fournisseur

#### Formulaire CinetPay
```typescript
interface CinetPayForm {
  amount: number;           // Montant en XOF
  operator: string;         // MTN, MOOV, ORANGE
  phoneNumber: string;      // 8 chiffres sans préfixe
}
```

#### Formulaire Moneroo
```typescript
interface MonerooForm {
  amount: number;           // Montant
  country: string;          // Code pays
  phoneNumber: string;      // Numéro complet avec préfixe
  paymentMethod: string;    // Méthode de paiement
}
```

## Backend - Routes et Contrôleurs

### Routes CinetPay

```javascript
// POST /api/payments/cinetpay/initiate
// Initie une transaction CinetPay
router.post('/cinetpay/initiate', verifyToken, paymentController.initiateCinetPayTransaction);

// POST /api/payments/cinetpay/notification
// Reçoit les notifications de CinetPay
router.post('/cinetpay/notification', paymentController.handleCinetPayNotification);

// GET /api/payments/cinetpay/status/:transactionId
// Vérifie le statut d'une transaction
router.get('/cinetpay/status/:transactionId', verifyToken, paymentController.getCinetPayStatus);
```

### Routes Moneroo

```javascript
// POST /api/payments/moneroo/initiate
// Initie une transaction Moneroo
router.post('/moneroo/initiate', verifyToken, monerooController.initiate);

// POST /api/payments/withdraw
// Retrait via Moneroo
router.post('/withdraw', verifyToken, monerooController.withdraw);
```

## Configuration

### Variables d'Environnement

```env
# Configuration CinetPay
CINETPAY_API_KEY=778574534683886413e3352.77859318
CINETPAY_SITE_ID=105896683
CINETPAY_ENVIRONMENT=PROD
CINETPAY_CALLBACK_URL=http://localhost:5173/wallet/callback/cinetpay
CINETPAY_NOTIFICATION_URL=http://localhost:5000/api/payments/cinetpay/notification

# Configuration Moneroo
MONEROO_API_KEY=your_moneroo_api_key
MONEROO_SECRET_KEY=your_moneroo_secret_key
MONEROO_ENVIRONMENT=live
MONEROO_CALLBACK_URL=http://localhost:5173/wallet/callback/moneroo
```

### Configuration par Défaut

```javascript
const config = {
  cinetpay: {
    apiKey: '778574534683886413e3352.77859318',
    siteId: '105896683',
    environment: 'PROD',
    callbackUrl: 'http://localhost:5173/wallet/callback/cinetpay',
    notificationUrl: 'http://localhost:5000/api/payments/cinetpay/notification'
  },
  moneroo: {
    apiKey: process.env.MONEROO_API_KEY,
    secretKey: process.env.MONEROO_SECRET_KEY,
    environment: 'live',
    callbackUrl: 'http://localhost:5173/wallet/callback/moneroo'
  }
};
```

## Validation des Données

### Numéros de Téléphone CinetPay

#### Format attendu
- 8 chiffres sans préfixe pays (229) ni 0 initial
- Exemple : `56962433` (pour +229 56 96 24 33)

#### Préfixes valides par opérateur

**MTN**
- `05`, `06`, `51`, `52`, `53`, `54`, `55`, `56`, `57`, `58`, `59`, `67`, `68`, `69`, `66`, `60`, `61`

**Moov**
- `01`, `02`, `03`, `40`, `41`, `42`, `43`, `44`, `45`

**Orange**
- `07`, `08`, `09`, `90`, `91`, `92`, `93`, `94`, `95`, `96`, `97`

### Validation côté Frontend

```typescript
// Service CinetPay
validatePhoneNumber(phoneNumber: string): boolean
getOperatorFromPhone(phoneNumber: string): string | null
formatPhoneNumber(phoneNumber: string): string
```

## Flux de Paiement

### CinetPay

1. **Initiation** : `POST /api/payments/cinetpay/initiate`
   ```json
   {
     "amount": 1000,
     "customer_phone_number": "56962433"
   }
   ```

2. **Réponse** :
   ```json
   {
     "transaction_id": "TRANS_1234567890_abc123",
     "payment_token": "token_123456",
     "payment_url": "https://checkout.cinetpay.com/pay/..."
   }
   ```

3. **Notification** : CinetPay envoie une notification à `/api/payments/cinetpay/notification`

4. **Vérification** : `GET /api/payments/cinetpay/status/:transactionId`

### Moneroo

1. **Initiation** : `POST /api/payments/moneroo/initiate`
   ```json
   {
     "amount": 1000,
     "description": "Rechargement portefeuille",
     "paymentMethod": "mtn_bj",
     "country": "BJ",
     "phoneNumber": "22956962433"
   }
   ```

2. **Réponse** :
   ```json
   {
     "success": true,
     "data": {
       "paymentUrl": "https://checkout.moneroo.com/pay/..."
     }
   }
   ```

## Gestion des Erreurs

### Erreurs CinetPay

```javascript
// Numéro de téléphone invalide
{
  "message": "Format de numéro invalide: 7 chiffres trouvés, 8 attendus"
}

// Configuration manquante
{
  "message": "Configuration CinetPay manquante"
}

// Échec de paiement
{
  "message": "Échec de l'initiation du paiement CinetPay"
}
```

### Erreurs Moneroo

```javascript
// Montant invalide
{
  "message": "Le montant doit être supérieur à 0"
}

// Méthode de paiement invalide
{
  "message": "Méthode de paiement non supportée"
}
```

## Sécurité

### Validation des Notifications

- Vérification du statut auprès du fournisseur
- Validation des champs requis
- Protection contre les doublons

### Transactions

- Sessions MongoDB pour la cohérence
- Vérification de propriété des transactions
- Protection contre les modifications multiples

## Tests

### Script de Test

```bash
# Test CinetPay uniquement
node test-cinetpay.js

# Test complet des paiements
node test-payment-integration.js
```

### Tests Manuels

1. **Test CinetPay** :
   - Utiliser un numéro de téléphone béninois valide
   - Vérifier la validation de l'opérateur
   - Tester le flux complet

2. **Test Moneroo** :
   - Utiliser différents pays
   - Tester différentes méthodes de paiement
   - Vérifier les retours

## Déploiement

### Production

1. **Variables d'environnement** :
   - Configurer les URLs de production
   - Utiliser les clés API de production
   - Configurer les callbacks HTTPS

2. **Base de données** :
   - Vérifier les index sur les transactions
   - Configurer les sauvegardes

3. **Monitoring** :
   - Surveiller les logs de paiement
   - Configurer les alertes d'erreur

### Développement

1. **Variables d'environnement** :
   - Utiliser les URLs locales
   - Utiliser les clés API de test

2. **Base de données** :
   - Utiliser une base de données de test
   - Nettoyer régulièrement les données de test

## Support

### Logs

Les interactions de paiement sont loggées avec des préfixes :
- `✅` : Succès
- `❌` : Erreur
- `🔍` : Vérification

### Debugging

1. **Vérifier les logs du serveur**
2. **Tester les endpoints avec Postman**
3. **Vérifier la configuration**
4. **Contrôler les notifications**

## Changelog

### Version 2.0.0
- Interface de choix entre CinetPay et Moneroo
- Formulaires spécifiques par fournisseur
- Validation améliorée des numéros de téléphone
- Gestion des erreurs complète

### Version 1.0.0
- Intégration initiale CinetPay
- Intégration initiale Moneroo
- Routes et contrôleurs de base 