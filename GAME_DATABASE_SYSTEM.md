# 🎮 Système de Bases de Données Dédiées par Jeu

## 📋 Vue d'ensemble

Ce système crée automatiquement une base de données MongoDB dédiée pour chaque jeu enregistré dans la plateforme Arena. Cela permet d'isoler les données de chaque jeu et d'optimiser les performances.

---

## 🏗️ Architecture

### Structure des Bases de Données

Pour chaque jeu, une base de données séparée est créée avec le format de nom suivant :
```
game_<nom_du_jeu_formaté>_<8_premiers_caractères_de_l'id>
```

**Exemple** :
- Jeu : "EA FC 25"
- ID : `673c5e8a9f1b2c3d4e5f6a7b`
- Nom de DB : `game_ea_fc_25_673c5e8a`

---

## 📦 Collections par Défaut

Chaque base de données de jeu contient les collections suivantes :

### 1. **Players** (Joueurs)
Stocke les informations des joueurs inscrits au jeu.

```javascript
{
  userId: ObjectId,              // Référence vers User dans DB principale
  inGameUsername: String,        // Pseudo in-game
  inGameEmail: String,           // Email in-game
  inGameId: String,              // ID du joueur dans le jeu
  level: Number,                 // Niveau du joueur
  experience: Number,            // Points d'expérience
  wins: Number,                  // Victoires
  losses: Number,                // Défaites
  draws: Number,                 // Matchs nuls
  statistics: Mixed,             // Statistiques personnalisées
  achievements: [String],        // Succès débloqués
  registeredAt: Date,            // Date d'inscription
  lastActive: Date               // Dernière activité
}
```

### 2. **Matches** (Matchs)
Historique des matchs joués dans ce jeu.

```javascript
{
  tournamentId: ObjectId,        // Référence vers Tournament
  players: [ObjectId],           // Liste des joueurs
  scores: [{
    playerId: ObjectId,
    score: Number
  }],
  winner: ObjectId,              // ID du gagnant
  matchData: Mixed,              // Données spécifiques au match
  status: String,                // pending, in_progress, completed, etc.
  startedAt: Date,               // Date de début
  completedAt: Date              // Date de fin
}
```

### 3. **Statistics** (Statistiques)
Statistiques agrégées par période.

```javascript
{
  playerId: ObjectId,            // ID du joueur
  date: Date,                    // Date des stats
  statsType: String,             // daily, weekly, monthly, all-time
  data: Mixed                    // Données statistiques
}
```

### 4. **Metadata** (Métadonnées)
Informations sur la base de données du jeu.

```javascript
{
  gameId: ObjectId,              // ID du jeu
  gameName: String,              // Nom du jeu
  createdAt: Date,               // Date de création
  version: String,               // Version du schéma
  lastMigration: Date,           // Dernière migration
  customSettings: Mixed          // Paramètres personnalisés
}
```

---

## 🚀 Utilisation

### Création Automatique

Lorsqu'un nouveau jeu est créé via l'API, une base de données est automatiquement créée :

```javascript
POST /api/games
{
  "name": "EA FC 25",
  "description": "...",
  "category": "sport",
  "publisher": "EA Sports"
}
```

### Vérification des Bases de Données Manquantes

Pour vérifier et créer les bases de données pour tous les jeux existants :

```javascript
POST /api/games/databases/verify
```

**Réponse** :
```json
{
  "success": true,
  "message": "Vérification des bases de données terminée",
  "results": {
    "total": 5,
    "created": 2,
    "existing": 3,
    "errors": [],
    "details": [
      {
        "gameId": "673c5e8a9f1b2c3d4e5f6a7b",
        "gameName": "EA FC 25",
        "status": "created",
        "dbName": "game_ea_fc_25_673c5e8a"
      }
    ]
  }
}
```

### Créer une Base de Données pour un Jeu Spécifique

```javascript
POST /api/games/:gameId/database
```

### Supprimer une Base de Données

```javascript
DELETE /api/games/:gameId/database
```

### Obtenir les Informations d'une Base de Données

```javascript
GET /api/games/:gameId/database/info
```

**Réponse** :
```json
{
  "success": true,
  "gameId": "673c5e8a9f1b2c3d4e5f6a7b",
  "gameName": "EA FC 25",
  "databaseName": "game_ea_fc_25_673c5e8a",
  "databaseCreatedAt": "2025-11-07T10:30:00.000Z",
  "hasActiveConnection": true,
  "collections": ["players", "matches", "statistics", "metadata"],
  "stats": {
    "collections": 4,
    "dataSize": 1024000,
    "indexSize": 204800,
    "totalSize": 1228800
  }
}
```

---

## 🔄 Initialisation au Démarrage

Au démarrage du serveur, le système vérifie automatiquement tous les jeux existants et crée les bases de données manquantes.

**Log de démarrage** :
```
✅ Connecté à MongoDB
✅ Base de données initialisée avec succès
✅ Admin initialisé avec succès
✅ Substitute players check complete.
🔍 Vérification des bases de données des jeux...
📦 Création de la base de données pour le jeu: EA FC 25
✅ Connexion établie pour game_ea_fc_25_673c5e8a
📋 Initialisation des collections pour EA FC 25...
✅ Collections initialisées pour EA FC 25
✅ Bases de données des jeux vérifiées
```

---

## 🔐 Sécurité

- **Authentification requise** : Toutes les routes nécessitent un token JWT valide
- **Rôle Admin** : Les opérations de gestion de bases de données sont réservées aux administrateurs
- **Isolation** : Chaque jeu a sa propre base de données isolée

---

## 📊 Avantages

✅ **Isolation des données** : Les données de chaque jeu sont séparées
✅ **Performance optimisée** : Requêtes plus rapides sur des bases plus petites
✅ **Scalabilité** : Possibilité de distribuer les BDs sur différents serveurs
✅ **Maintenance facilitée** : Backup et migration par jeu
✅ **Flexibilité** : Schémas personnalisables par jeu

---

## ⚠️ Points d'Attention

### Connexions MongoDB
Le système maintient une connexion active pour chaque base de données de jeu. Surveillez le nombre de connexions :

```javascript
// Vérifier les connexions actives
gameDatabaseService.gameConnections.size
```

### Limites MongoDB
- Par défaut, MongoDB Atlas limite le nombre de bases de données
- Vérifiez votre plan MongoDB pour les limites

### Backup
Assurez-vous que vos stratégies de backup incluent toutes les bases de données de jeux.

---

## 🛠️ API Complète

| Méthode | Endpoint | Description | Rôle |
|---------|----------|-------------|------|
| POST | `/api/games/databases/verify` | Vérifier et créer les BDs manquantes | Admin |
| POST | `/api/games/:id/database` | Créer une BD pour un jeu | Admin |
| DELETE | `/api/games/:id/database` | Supprimer la BD d'un jeu | Admin |
| GET | `/api/games/:id/database/info` | Info sur la BD d'un jeu | Admin |

---

## 💡 Exemples d'Utilisation

### Exemple 1 : Créer un Jeu avec sa Base de Données

```javascript
// 1. Créer le jeu (la BD est créée automatiquement)
const response = await fetch('/api/games', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Call of Duty',
    description: 'Jeu de tir tactique',
    category: 'action',
    publisher: 'Activision',
    status: 'active'
  })
});

// 2. Vérifier la création de la BD
const gameId = response.data.game._id;
const dbInfo = await fetch(`/api/games/${gameId}/database/info`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Exemple 2 : Migration des Jeux Existants

```javascript
// Créer les bases de données pour tous les jeux existants
const response = await fetch('/api/games/databases/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

console.log(`BDs créées: ${response.results.created}`);
console.log(`BDs existantes: ${response.results.existing}`);
```

---

## 🔧 Configuration

### Variables d'Environnement

Le système utilise l'URI MongoDB principal défini dans `config.js` :

```javascript
mongoURI: process.env.MONGODB_URI
```

Les bases de données de jeux sont créées sur le même cluster MongoDB.

---

## 📝 Modèle de Données Étendu

Le modèle `Game` a été étendu avec :

```javascript
{
  // ... champs existants ...
  databaseName: String,          // Nom de la base de données
  databaseCreatedAt: Date        // Date de création de la BD
}
```

---

## 🎯 Cas d'Usage

### 1. Gestion des Statistiques
Stocker les statistiques détaillées des joueurs pour chaque jeu sans surcharger la base principale.

### 2. Historique des Matchs
Conserver l'historique complet des matchs par jeu avec des performances optimales.

### 3. Leaderboards
Calculer rapidement les classements par jeu avec des index optimisés.

### 4. Événements Spéciaux
Créer des collections temporaires pour des événements spéciaux par jeu.

---

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement.

---

**Version** : 1.0.0  
**Date** : Novembre 2025  
**Auteur** : Arena Backend Team
