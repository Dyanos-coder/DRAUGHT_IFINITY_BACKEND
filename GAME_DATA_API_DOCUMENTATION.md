# 📡 Documentation des Routes Game Data

## Vue d'ensemble

Ces routes permettent de gérer les données spécifiques aux jeux dans leurs bases de données dédiées. Chaque jeu a sa propre base MongoDB avec ses propres collections (players, matches, statistics, metadata).

**Base URL** : `/api/game-data`

---

## 🏆 Routes des Tournois

### 1. Récupérer les tournois d'un jeu

**Endpoint** : `GET /api/game-data/:gameId/tournaments`

**Description** : Récupère la liste des tournois d'un jeu spécifique avec les statistiques enrichies depuis la base de données du jeu.

**Authentification** : Requise (JWT Token)

**Paramètres URL** :
- `gameId` (string, requis) : ID du jeu

**Query Parameters** :
- `status` (string, optionnel) : Filtrer par statut (`upcoming`, `open`, `in-progress`, `complete`, `all`)
- `limit` (number, optionnel) : Nombre de résultats par page (défaut: 20)
- `page` (number, optionnel) : Numéro de page (défaut: 1)

**Exemple de requête** :
```bash
curl -X GET "http://localhost:5000/api/game-data/673c5e8a9f1b2c3d4e5f6a7b/tournaments?status=open&limit=10&page=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Réponse réussie (200)** :
```json
{
  "success": true,
  "data": {
    "tournaments": [
      {
        "_id": "673...",
        "title": "Tournoi EA FC 25 - Novembre",
        "description": "Tournoi mensuel",
        "prize": 50000,
        "status": "open",
        "date": "2025-11-15T14:00:00.000Z",
        "maxPlayers": 16,
        "players": [
          {
            "_id": "673...",
            "username": "Player1",
            "email": "player1@example.com",
            "gameStats": {
              "level": 15,
              "experience": 15420,
              "wins": 45,
              "losses": 12
            }
          }
        ],
        "matchCount": 7,
        "entryFee": 5000
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  },
  "game": {
    "_id": "673...",
    "name": "EA FC 25",
    "hasDatabase": true
  }
}
```

---

## 👥 Routes des Joueurs

### 2. Inscrire un joueur dans un jeu

**Endpoint** : `POST /api/game-data/:gameId/players/register`

**Description** : Inscrit un joueur dans la base de données dédiée d'un jeu avec ses identifiants in-game.

**Authentification** : Requise (JWT Token)

**Paramètres URL** :
- `gameId` (string, requis) : ID du jeu

**Corps de la requête** :
```json
{
  "inGameUsername": "ProPlayer123",
  "inGameEmail": "proplayer@game.com",
  "inGamePassword": "SecurePassword123",
  "inGameId": "PLAYER-12345"
}
```

**Champs requis** :
- `inGameUsername` (string) : Pseudo in-game du joueur
- `inGameEmail` (string) : Email in-game
- `inGamePassword` (string) : Mot de passe in-game (sera hashé)

**Champs optionnels** :
- `inGameId` (string) : ID du joueur dans le jeu (si applicable)

**Exemple de requête** :
```bash
curl -X POST "http://localhost:5000/api/game-data/673c5e8a9f1b2c3d4e5f6a7b/players/register" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inGameUsername": "ProPlayer123",
    "inGameEmail": "proplayer@game.com",
    "inGamePassword": "SecurePassword123",
    "inGameId": "PLAYER-12345"
  }'
```

**Réponse réussie (201)** :
```json
{
  "success": true,
  "message": "Inscription au jeu réussie",
  "player": {
    "_id": "673...",
    "userId": "673...",
    "inGameUsername": "ProPlayer123",
    "inGameEmail": "proplayer@game.com",
    "inGameId": "PLAYER-12345",
    "level": 1,
    "experience": 0,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "statistics": {},
    "achievements": [],
    "registeredAt": "2025-11-07T10:30:00.000Z",
    "lastActive": "2025-11-07T10:30:00.000Z"
  },
  "game": {
    "_id": "673...",
    "name": "EA FC 25"
  }
}
```

**Erreurs possibles** :
- `400` : Données manquantes ou invalides
- `400` : Joueur déjà inscrit à ce jeu
- `400` : Pseudo ou email in-game déjà utilisé
- `404` : Jeu non trouvé

---

### 3. Obtenir les détails d'un joueur

**Endpoint** : `GET /api/game-data/:gameId/players/:userId`

**Description** : Récupère les détails et statistiques d'un joueur dans un jeu spécifique.

**Authentification** : Requise (JWT Token)

**Paramètres URL** :
- `gameId` (string, requis) : ID du jeu
- `userId` (string, requis) : ID de l'utilisateur

**Exemple de requête** :
```bash
curl -X GET "http://localhost:5000/api/game-data/673c5e8a9f1b2c3d4e5f6a7b/players/673c5e8c9f1b2c3d4e5f6a7d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Réponse réussie (200)** :
```json
{
  "success": true,
  "player": {
    "_id": "673...",
    "userId": "673...",
    "inGameUsername": "ProPlayer123",
    "inGameEmail": "proplayer@game.com",
    "inGameId": "PLAYER-12345",
    "level": 15,
    "experience": 15420,
    "wins": 45,
    "losses": 12,
    "draws": 3,
    "statistics": {},
    "achievements": ["first_win", "level_10"],
    "registeredAt": "2025-10-01T10:00:00.000Z",
    "lastActive": "2025-11-07T09:45:00.000Z",
    "stats": {
      "totalGames": 60,
      "winRate": 75.00
    }
  },
  "game": {
    "_id": "673...",
    "name": "EA FC 25"
  }
}
```

---

### 4. Obtenir l'historique des matchs d'un joueur

**Endpoint** : `GET /api/game-data/:gameId/players/:userId/matches`

**Description** : Récupère l'historique complet des matchs d'un joueur dans un jeu.

**Authentification** : Requise (JWT Token)

**Paramètres URL** :
- `gameId` (string, requis) : ID du jeu
- `userId` (string, requis) : ID de l'utilisateur

**Query Parameters** :
- `limit` (number, optionnel) : Nombre de résultats par page (défaut: 20)
- `page` (number, optionnel) : Numéro de page (défaut: 1)

**Exemple de requête** :
```bash
curl -X GET "http://localhost:5000/api/game-data/673c5e8a9f1b2c3d4e5f6a7b/players/673c5e8c9f1b2c3d4e5f6a7d/matches?limit=10&page=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Réponse réussie (200)** :
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "matchId": "673...",
        "tournamentId": "673...",
        "date": "2025-11-06T15:30:00.000Z",
        "won": true,
        "playerScore": 3,
        "allScores": [
          { "playerId": "673...", "score": 3 },
          { "playerId": "673...", "score": 1 }
        ],
        "status": "completed",
        "matchData": {}
      }
    ],
    "pagination": {
      "total": 60,
      "page": 1,
      "limit": 10,
      "totalPages": 6
    }
  },
  "player": {
    "userId": "673...",
    "inGameUsername": "ProPlayer123",
    "level": 15
  },
  "game": {
    "_id": "673...",
    "name": "EA FC 25"
  }
}
```

---

## ⚔️ Routes des Matchs

### 5. Mettre à jour le score d'un match

**Endpoint** : `PUT /api/game-data/:gameId/matches/:matchId/score`

**Description** : Met à jour le score d'un match dans la base de données d'un jeu. Seuls les joueurs du match ou les admins peuvent effectuer cette action.

**Authentification** : Requise (JWT Token)

**Autorisation** : Joueur participant au match OU Admin

**Paramètres URL** :
- `gameId` (string, requis) : ID du jeu
- `matchId` (string, requis) : ID du match dans la base de données du jeu

**Corps de la requête** :
```json
{
  "scores": [
    { "playerId": "673c5e8c9f1b2c3d4e5f6a7d", "score": 3 },
    { "playerId": "673c5e8d9f1b2c3d4e5f6a7e", "score": 1 }
  ],
  "winner": "673c5e8c9f1b2c3d4e5f6a7d",
  "status": "completed",
  "matchData": {
    "duration": 45,
    "highlights": ["goal_1", "goal_2"]
  }
}
```

**Champs requis** :
- `scores` (array) : Tableau d'objets avec `playerId` et `score`

**Champs optionnels** :
- `winner` (string) : ID du joueur gagnant
- `status` (string) : Statut du match (`pending`, `in_progress`, `completed`, `cancelled`, `disputed`)
- `matchData` (object) : Données supplémentaires du match

**Exemple de requête** :
```bash
curl -X PUT "http://localhost:5000/api/game-data/673c5e8a9f1b2c3d4e5f6a7b/matches/673c5e8e9f1b2c3d4e5f6a7f/score" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scores": [
      { "playerId": "673c5e8c9f1b2c3d4e5f6a7d", "score": 3 },
      { "playerId": "673c5e8d9f1b2c3d4e5f6a7e", "score": 1 }
    ],
    "winner": "673c5e8c9f1b2c3d4e5f6a7d",
    "status": "completed"
  }'
```

**Réponse réussie (200)** :
```json
{
  "success": true,
  "message": "Score du match mis à jour avec succès",
  "match": {
    "_id": "673...",
    "tournamentId": "673...",
    "players": ["673...", "673..."],
    "scores": [
      { "playerId": "673...", "score": 3 },
      { "playerId": "673...", "score": 1 }
    ],
    "winner": "673...",
    "status": "completed",
    "startedAt": "2025-11-07T14:00:00.000Z",
    "completedAt": "2025-11-07T15:00:00.000Z",
    "matchData": {},
    "playersDetails": [
      {
        "userId": "673...",
        "inGameUsername": "ProPlayer123",
        "level": 16,
        "experience": 15520,
        "wins": 46,
        "losses": 12
      }
    ]
  },
  "game": {
    "_id": "673...",
    "name": "EA FC 25"
  }
}
```

**Effets de bord** :
- Si `status = "completed"` et `winner` fourni :
  - ✅ Stats des joueurs mises à jour (wins/losses)
  - ✅ Expérience ajoutée (100 pour victoire, 25 pour défaite)
  - ✅ Niveau recalculé si nécessaire
  - ✅ `completedAt` défini

**Erreurs possibles** :
- `400` : Scores manquants ou invalides
- `400` : Joueur non participant au match
- `403` : Non autorisé (pas joueur ni admin)
- `404` : Jeu ou match non trouvé

---

## 🔐 Authentification

Toutes les routes nécessitent un token JWT dans l'en-tête :

```
Authorization: Bearer <votre_token_jwt>
```

Pour obtenir un token :
```bash
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

---

## 📊 Codes de Statut HTTP

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## 🎯 Flux d'Utilisation Typique

### 1. Un joueur s'inscrit à un jeu

```javascript
// 1. Inscription au jeu
POST /api/game-data/673.../players/register
{
  "inGameUsername": "ProPlayer",
  "inGameEmail": "pro@game.com",
  "inGamePassword": "pass123"
}

// 2. Vérifier son profil
GET /api/game-data/673.../players/USER_ID
```

### 2. Participation à un tournoi

```javascript
// 1. Voir les tournois disponibles
GET /api/game-data/673.../tournaments?status=open

// 2. S'inscrire au tournoi (via route principale)
POST /api/tournaments/TOURNAMENT_ID/register

// 3. Jouer un match et soumettre le score
PUT /api/game-data/673.../matches/MATCH_ID/score
{
  "scores": [...],
  "winner": "USER_ID",
  "status": "completed"
}

// 4. Voir l'historique
GET /api/game-data/673.../players/USER_ID/matches
```

---

## 💡 Exemples d'Utilisation Frontend

### React/JavaScript

```javascript
// Inscrire un joueur à un jeu
const registerToGame = async (gameId, credentials) => {
  try {
    const response = await fetch(`/api/game-data/${gameId}/players/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    console.log('Inscription réussie:', data);
    return data;
  } catch (error) {
    console.error('Erreur:', error);
  }
};

// Mettre à jour un score
const updateScore = async (gameId, matchId, scoreData) => {
  try {
    const response = await fetch(
      `/api/game-data/${gameId}/matches/${matchId}/score`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scoreData)
      }
    );
    
    return await response.json();
  } catch (error) {
    console.error('Erreur:', error);
  }
};
```

---

## 🐛 Dépannage

### Erreur : "Base de données du jeu non trouvée"

**Solution** : Créer la base de données du jeu
```bash
POST /api/games/:gameId/database
```

### Erreur : "Joueur déjà inscrit"

**Solution** : Utiliser GET pour récupérer les infos du joueur
```bash
GET /api/game-data/:gameId/players/:userId
```

### Erreur : "Non autorisé à mettre à jour ce match"

**Solution** : Vérifier que :
- Vous êtes un des joueurs du match
- OU vous êtes admin

---

## 📚 Ressources Connexes

- [Documentation Système de Bases de Données](./GAME_DATABASE_SYSTEM.md)
- [Guide de Démarrage Rapide](./GAME_DATABASE_QUICKSTART.md)
- [Exemples de Code](./game-database-examples.js)

---

**Version** : 1.0.0  
**Date** : Novembre 2025
