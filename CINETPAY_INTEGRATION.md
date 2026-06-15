# Intégration CinetPay - Guide Complet

## Vue d'ensemble

CinetPay est une plateforme de paiement mobile qui fonctionne dans plusieurs pays d'Afrique. Cette intégration permet aux utilisateurs de recharger leur portefeuille via différents moyens de paiement selon leur pays.

## Pays Supportés

### Côte d'Ivoire (CI)
- **Devise**: XOF
- **Montants**: 100 - 1,500,000 XOF
- **Méthodes de paiement**:
  - OM (Orange Money CI)
  - FLOOZ (Moov money CI)
  - MOMO (Mtn Mobile Money CI)
  - VISAM (VISA/MasterCard CI)
  - WAVECI (Wave CI)

### Sénégal (SN)
- **Devise**: XOF
- **Montants**: 100 - 2,000,000 XOF
- **Méthodes de paiement**:
  - EXPRESSOSN (EXPRESSO SN)
  - OMSN (Orange Money SN)
  - FREESN (Free Money SN)
  - WAVESN (Wave SN)

### Togo (TG)
- **Devise**: XOF
- **Montants**: 150 - 1,500,000 XOF
- **Méthodes de paiement**:
  - TmoneyTG (Tmoney TG)
  - FLOOZTG (Flooz TG)

### Bénin (BJ)
- **Devise**: XOF
- **Montants**: 100 - 1,500,000 XOF
- **Méthodes de paiement**:
  - MTNBJ (Mtn Mobile Money Benin)
  - MOOVBJ (Moov Mobile Money Benin)

### Mali (ML)
- **Devise**: XOF
- **Montants**: 100 - 1,500,000 XOF
- **Méthodes de paiement**:
  - OMML (Orange Money ML)
  - MOOVML (Moov Money ML)

### Burkina Faso (BF)
- **Devise**: XOF
- **Montants**: 100 - 1,500,000 XOF
- **Méthodes de paiement**:
  - OMBF (Orange Money BF)
  - MOOVBF (Moov money BF)

### Cameroun (CM)
- **Devise**: XAF
- **Montants**: 100 - 1,500,000 XAF
- **Méthodes de paiement**:
  - OMCM (Orange Money CM)
  - EXPRESSUNIONCM (Express union CM)
  - VISAMCM (VISA/MasterCard CM)
  - MTNCM (Mtn Money CM)

### Guinée (GN)
- **Devise**: GNF
- **Montants**: 1,000 - 15,000,000 GNF
- **Méthodes de paiement**:
  - MTNGN (MTN Mobile Money GN)
  - OMGN (Orange Money GN)

### Congo (RDC) - CDF
- **Devise**: CDF
- **Montants**: 100 - 2,000,000 CDF
- **Méthodes de paiement**:
  - OMCD (Orange Money CD)
  - MPESACD (M PESA CD)
  - AIRTELCD (Airtel Money CD)

### Congo (RDC) - USD
- **Devise**: USD
- **Montants**: 1 - 3,000 USD
- **Méthodes de paiement**:
  - OMCDUSD (Orange Money CDUSD)
  - AIRTELCDUSD (Airtel Money CDUSD)
  - MPESACDUSD (M PESA CDUSD)
  - VISAMCDUSD (VISA/MasterCard CDUSD)

## Configuration

### Variables d'environnement

```env
# CinetPay Configuration
CINETPAY_API_KEY=778574534683886413e3352.77859318
CINETPAY_SITE_ID=105896683
CINETPAY_ENVIRONMENT=PROD
CINETPAY_CALLBACK_URL=https://votre-domaine.com/wallet/callback/cinetpay
CINETPAY_NOTIFICATION_URL=https://votre-domaine.com/api/payments/cinetpay/notification
```

### Configuration dans `config.js`

```javascript
cinetpay: {
  apiKey: process.env.CINETPAY_API_KEY,
  siteId: process.env.CINETPAY_SITE_ID,
  environment: process.env.CINETPAY_ENVIRONMENT || 'PROD',
  callbackUrl: process.env.CINETPAY_CALLBACK_URL,
  notificationUrl: process.env.CINETPAY_NOTIFICATION_URL
}
```

## API Endpoints

### 1. Initier un paiement CinetPay

**POST** `/api/payments/cinetpay/initiate`

**Corps de la requête**:
```json
{
  "apikey": "YOUR_APIKEY",
  "site_id": "YOUR_SITEID",
  "transaction_id": "123456789",
  "amount": 100,
  "currency": "XOF",
  "alternative_currency": "",
  "description": "Rechargement de portefeuille",
  "customer_id": "user123",
  "customer_name": "John",
  "customer_surname": "Doe",
  "customer_email": "john@example.com",
  "customer_phone_number": "+225004315545",
  "customer_address": "Adresse",
  "customer_city": "Ville",
  "customer_country": "CI",
  "customer_state": "CI",
  "customer_zip_code": "00000",
  "notify_url": "https://webhook.site/...",
  "return_url": "https://votre-domaine.com/wallet/callback/cinetpay",
  "channels": "OM",
  "metadata": "user123",
  "lang": "FR",
  "invoice_data": {
    "user_id": "user123",
    "username": "johndoe"
  }
}
```

**Réponse**:
```json
{
  "transaction_id": "123456789",
  "payment_token": "token123",
  "payment_url": "https://checkout.cinetpay.com/..."
}
```

### 2. Notification de paiement

**POST** `/api/payments/cinetpay/notification`

**Corps de la requête**:
```json
{
  "transaction_id": "123456789",
  "payment_token": "token123",
  "status": "SUCCESSFUL",
  "amount": 100,
  "currency": "XOF"
}
```

### 3. Callback de paiement

**GET** `/api/payments/cinetpay/callback`

**Paramètres**:
- `transaction_id`: ID de la transaction
- `payment_token`: Token de paiement
- `status`: Statut du paiement

## Flux de paiement

1. **Sélection du pays**: L'utilisateur choisit son pays dans l'interface
2. **Sélection de la méthode**: Les méthodes de paiement disponibles sont affichées selon le pays
3. **Saisie des informations**: L'utilisateur saisit le montant et son numéro de téléphone
4. **Initiation du paiement**: Le système envoie une requête à CinetPay
5. **Redirection**: L'utilisateur est redirigé vers la page de paiement CinetPay
6. **Paiement**: L'utilisateur effectue le paiement sur la plateforme CinetPay
7. **Notification**: CinetPay notifie le système du statut du paiement
8. **Callback**: L'utilisateur est redirigé vers l'application avec le statut

## Validation des données

### Numéro de téléphone
- Format international requis: `+225004315545`
- Doit inclure le préfixe pays
- Validation côté client et serveur

### Montant
- Doit respecter les limites du pays sélectionné
- Validation selon les montants min/max par pays

### Pays et méthode de paiement
- Le pays doit être dans la liste des pays supportés
- La méthode de paiement doit correspondre au pays sélectionné

## Gestion des erreurs

### Erreurs courantes

1. **Configuration manquante**
   ```
   Configuration CinetPay manquante. Veuillez vérifier CINETPAY_API_KEY et CINETPAY_SITE_ID
   ```

2. **Données invalides**
   ```
   Le montant doit être entre 100 et 1500000 XOF
   ```

3. **Méthode de paiement invalide**
   ```
   La méthode de paiement OM n'est pas disponible pour le pays BJ
   ```

4. **Numéro de téléphone invalide**
   ```
   Le numéro de téléphone doit être au format international (+225004315545)
   ```

## Tests

### Script de test

Exécutez le script de test pour vérifier l'intégration :

```bash
node test-cinetpay.js
```

### Tests manuels

1. **Test d'initiation de paiement**
   - Utilisez les données de test fournies
   - Vérifiez la réponse de l'API CinetPay

2. **Test de vérification de statut**
   - Utilisez un ID de transaction valide
   - Vérifiez le statut retourné

## Sécurité

### Bonnes pratiques

1. **Validation des données**
   - Validez toutes les données côté serveur
   - Vérifiez les montants selon les limites du pays

2. **Gestion des tokens**
   - Stockez les tokens de manière sécurisée
   - Validez les tokens lors des callbacks

3. **Notifications**
   - Vérifiez l'authenticité des notifications
   - Traitez les notifications de manière asynchrone

4. **Logs**
   - Enregistrez toutes les transactions
   - Surveillez les erreurs et anomalies

## Support

Pour toute question ou problème :

1. Consultez la documentation officielle CinetPay
2. Vérifiez les logs du serveur
3. Testez avec le script de test fourni
4. Contactez le support technique

## Changelog

### Version 2.0.0
- Support multi-pays ajouté
- Interface utilisateur améliorée avec sélection de pays
- Méthodes de paiement dynamiques selon le pays
- Validation des montants selon les limites par pays
- Documentation mise à jour

### Version 1.0.0
- Intégration initiale CinetPay
- Support pour le Bénin uniquement
- Paiements MTN et Moov 