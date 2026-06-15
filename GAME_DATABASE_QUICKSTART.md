# 🚀 Guide de Démarrage Rapide - Système de Bases de Données par Jeu

## 📖 Introduction

Le système de bases de données dédiées par jeu crée automatiquement une base MongoDB séparée pour chaque jeu enregistré dans la plateforme. Cela permet une meilleure organisation, performance et scalabilité.

---

## ⚡ Démarrage Rapide

### 1. Vérification Automatique au Démarrage

Le système vérifie automatiquement tous les jeux au démarrage du serveur :

```bash
npm start
# ou
npm run dev
```

Vous verrez dans les logs :
```
🔍 Vérification des bases de données des jeux...
📦 Création de la base de données pour le jeu: EA FC 25
✅ Base de données créée pour le jeu: EA FC 25
✅ Bases de données des jeux vérifiées
```

### 2. Vérification Manuelle

Pour vérifier et créer les bases de données manquantes :

```bash
npm run verify:game-db
```

### 3. Test du Système

Pour tester le système complet :

```bash
npm run test:game-db
```

---

## 🔧 Utilisation via l'API

### Créer un Nouveau Jeu

Lors de la création d'un jeu, la base de données est automatiquement créée :

```bash
curl -X POST http://localhost:5000/api/games \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EA FC 25",
    "description": "Jeu de simulation de football",
    "category": "sport",
    "publisher": "EA Sports",
    "status": "active"
  }'
```

### Vérifier Tous les Jeux

```bash
curl -X POST http://localhost:5000/api/games/databases/verify \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Informations sur une Base de Données

```bash
curl http://localhost:5000/api/games/GAME_ID/database/info \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Créer une Base de Données Manuellement

```bash
curl -X POST http://localhost:5000/api/games/GAME_ID/database \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Supprimer une Base de Données

```bash
curl -X DELETE http://localhost:5000/api/games/GAME_ID/database \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📊 Structure des Données

Chaque base de données de jeu contient :

- **players** : Joueurs inscrits au jeu
- **matches** : Historique des matchs
- **statistics** : Statistiques agrégées
- **metadata** : Métadonnées de la base

---

## 🔍 Vérification

### Vérifier les Connexions Actives

Dans le code :

```javascript
const gameDatabaseService = require('./src/services/gameDatabaseService');

// Nombre de connexions actives
console.log('Connexions actives:', gameDatabaseService.gameConnections.size);

// Vérifier si un jeu a une base de données
const hasDB = gameDatabaseService.hasGameDatabase(gameId);
console.log('A une BD:', hasDB);
```

### Logs de Démarrage

Surveillez ces logs au démarrage :

```
✅ Connecté à MongoDB
✅ Base de données initialisée avec succès
✅ Admin initialisé avec succès
✅ Substitute players check complete.
🔍 Vérification des bases de données des jeux...
   📊 Résumé:
      Total de jeux: 5
      Bases créées: 2
      Bases existantes: 3
      Erreurs: 0
✅ Bases de données des jeux vérifiées
```

---

## ⚠️ Troubleshooting

### Problème : La base de données n'est pas créée

**Solution 1** : Vérifier les connexions MongoDB
```bash
npm run verify:game-db
```

**Solution 2** : Créer manuellement via l'API
```bash
curl -X POST http://localhost:5000/api/games/GAME_ID/database \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Problème : Trop de connexions MongoDB

**Solution** : MongoDB a une limite de connexions. Vérifiez votre plan :
- MongoDB Atlas Free : 500 connexions max
- MongoDB Atlas Shared : 1500 connexions max

### Problème : Erreur lors de la création

**Vérifier** :
1. L'URI MongoDB est correcte dans `.env`
2. Vous avez les permissions de créer des bases de données
3. Le nom du jeu ne contient pas de caractères invalides

---

## 🎯 Exemples Pratiques

### Exemple 1 : Migration des Jeux Existants

```javascript
// Dans votre script de migration
const gameDatabaseService = require('./src/services/gameDatabaseService');

async function migrateGames() {
  const results = await gameDatabaseService.verifyAndCreateMissingDatabases();
  console.log(`✅ ${results.created} bases créées`);
  console.log(`✅ ${results.existing} bases déjà existantes`);
}

migrateGames();
```

### Exemple 2 : Utiliser une Base de Données de Jeu

```javascript
const gameDatabaseService = require('./src/services/gameDatabaseService');

async function addPlayerToGame(gameId, playerData) {
  // Obtenir la connexion du jeu
  const connection = gameDatabaseService.getGameConnection(gameId);
  
  if (!connection) {
    throw new Error('Base de données du jeu non trouvée');
  }
  
  // Utiliser le modèle Player de cette base
  const Player = connection.model('Player');
  
  // Créer le joueur
  const player = await Player.create(playerData);
  
  return player;
}
```

### Exemple 3 : Récupérer les Statistiques

```javascript
async function getGameStats(gameId) {
  const connection = gameDatabaseService.getGameConnection(gameId);
  
  const Player = connection.model('Player');
  const Match = connection.model('Match');
  
  const totalPlayers = await Player.countDocuments();
  const totalMatches = await Match.countDocuments();
  
  return { totalPlayers, totalMatches };
}
```

---

## 📝 Commandes Utiles

```bash
# Démarrer le serveur en mode développement
npm run dev

# Vérifier les bases de données des jeux
npm run verify:game-db

# Tester le système complet
npm run test:game-db

# Voir les logs en temps réel
npm run dev | grep "game"
```

---

## 🔐 Sécurité

- ✅ Toutes les routes nécessitent une authentification JWT
- ✅ Les opérations de gestion des BDs sont réservées aux admins
- ✅ Chaque base de données est isolée
- ✅ Les connexions sont poolées et optimisées

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- [GAME_DATABASE_SYSTEM.md](./GAME_DATABASE_SYSTEM.md) - Documentation complète
- [src/services/gameDatabaseService.js](./src/services/gameDatabaseService.js) - Code source

---

## 💡 Conseils

1. **Performance** : Les bases séparées améliorent les performances pour les jeux avec beaucoup de données
2. **Scalabilité** : Vous pouvez facilement déplacer des bases de jeux sur d'autres serveurs
3. **Backup** : Pensez à inclure toutes les bases de jeux dans vos backups
4. **Monitoring** : Surveillez le nombre de connexions actives

---

## 🆘 Support

En cas de problème :
1. Consultez les logs du serveur
2. Utilisez `npm run verify:game-db` pour diagnostiquer
3. Vérifiez la documentation complète dans `GAME_DATABASE_SYSTEM.md`

---

**Version** : 1.0.0  
**Dernière mise à jour** : Novembre 2025
