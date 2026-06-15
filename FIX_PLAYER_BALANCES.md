# Correction des Soldes des Joueurs (Pièces et Énergie)

## Problème Identifié

L'application mobile affichait 0 pour les pièces et l'énergie des joueurs alors que les données existaient dans la base de données. 

### Causes

1. **Réponse de Login Incomplète**: Les champs `soldePiece` et `soldeEnergie` n'étaient pas inclus dans la réponse JSON lors de la connexion d'un joueur.

2. **Création de Joueur Incomplète**: Les nouveaux joueurs créés n'avaient pas ces champs initialisés explicitement, comptant uniquement sur les valeurs par défaut du schéma.

3. **Joueurs Existants**: Certains joueurs créés avant la mise à jour du schéma n'avaient pas ces champs.

## Solutions Appliquées

### 1. Mise à jour de la Réponse de Login (`auth.controller.js`)

**Fichier**: `Arena_back/src/controllers/auth.controller.js`

```javascript
// AVANT (ligne 318-328)
player: {
  _id: playerInGame._id,
  inGameUsername: playerInGame.inGameUsername,
  // ... autres champs
  draws: playerInGame.draws
}

// APRÈS
player: {
  _id: playerInGame._id,
  inGameUsername: playerInGame.inGameUsername,
  // ... autres champs
  draws: playerInGame.draws,
  soldePiece: playerInGame.soldePiece || 0,      // ✅ AJOUTÉ
  soldeEnergie: playerInGame.soldeEnergie || 0   // ✅ AJOUTÉ
}
```

### 2. Initialisation Explicite lors de la Création

**Fichier 1**: `Arena_back/src/controllers/auth.controller.js` (ligne 101)

```javascript
const newPlayer = await Player.create({
  userId: null,
  inGameUsername: inGameUsername,
  inGameEmail: email,
  inGamePassword: hashedPassword,
  inGameId: inGameUsername,
  soldePiece: 0,      // ✅ AJOUTÉ
  soldeEnergie: 0     // ✅ AJOUTÉ
});
```

**Fichier 2**: `Arena_back/src/controllers/gameData.controller.js` (ligne 206)

```javascript
const newPlayer = await Player.create({
  userId,
  inGameUsername,
  inGameEmail,
  inGamePassword: hashedPassword,
  // ... autres champs
  draws: 0,
  soldePiece: 0,      // ✅ AJOUTÉ
  soldeEnergie: 0,    // ✅ AJOUTÉ
  statistics: {},
  // ...
});
```

### 3. Script de Correction pour Joueurs Existants

**Fichier**: `Arena_back/fix-player-balances.js`

Un script a été créé pour mettre à jour tous les joueurs existants qui n'ont pas ces champs.

## Comment Appliquer les Corrections

### Étape 1: Redémarrer le Backend

Les modifications du code sont déjà appliquées. Redémarrez simplement le serveur:

```bash
cd Arena_back
pnpm run dev
```

Au démarrage, la fonction `initializePlayerBalances()` s'exécutera automatiquement et mettra à jour les joueurs existants.

### Étape 2: (Optionnel) Forcer la Mise à Jour Manuelle

Si vous souhaitez forcer une mise à jour immédiate sans redémarrer le serveur:

```bash
cd Arena_back
pnpm run fix:player-balances
```

Ce script:
- ✅ Se connecte à toutes les bases de données de jeux
- ✅ Trouve tous les joueurs
- ✅ Met à jour `soldePiece` et `soldeEnergie` à 0 pour ceux qui n'ont pas ces champs
- ✅ Affiche un résumé détaillé

### Étape 3: Vérification

1. **Se connecter à l'app mobile** avec un compte joueur existant
2. **Vérifier que les pièces et l'énergie s'affichent** (même si c'est 0)
3. **Tester l'ajout de pièces/énergie** via les mécanismes du jeu

## Structure du Schéma Player

```javascript
const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  inGameUsername: { type: String, required: true },
  inGameEmail: { type: String, required: true },
  inGamePassword: { type: String, required: true },
  inGameId: { type: String },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  soldeEnergie: { type: Number, default: 0 },  // ✅ Solde d'énergie
  soldePiece: { type: Number, default: 0 },    // ✅ Solde de pièces
  statistics: { type: mongoose.Schema.Types.Mixed, default: {} },
  achievements: [{ type: String }],
  registeredAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });
```

## Vérification dans la Base de Données

Pour vérifier manuellement dans MongoDB:

```javascript
// Se connecter à la base de données d'un jeu
use game_<GAME_ID>

// Vérifier les joueurs
db.players.find({}, {
  inGameUsername: 1,
  soldePiece: 1,
  soldeEnergie: 1
}).pretty()

// Compter les joueurs sans soldes
db.players.count({
  $or: [
    { soldePiece: { $exists: false } },
    { soldeEnergie: { $exists: false } }
  ]
})
```

## Tests Recommandés

1. **Test de Login**: 
   - Se connecter avec un compte existant
   - Vérifier que la réponse JSON contient `soldePiece` et `soldeEnergie`

2. **Test de Création de Compte**:
   - Créer un nouveau compte joueur
   - Vérifier que les soldes sont initialisés à 0

3. **Test de l'App Mobile**:
   - Affichage des pièces
   - Affichage de l'énergie
   - Modification des soldes via les fonctionnalités du jeu

## Notes Importantes

- ✅ Les valeurs par défaut sont 0 pour les deux champs
- ✅ La fonction `initializePlayerBalances()` s'exécute automatiquement au démarrage du serveur
- ✅ Tous les nouveaux joueurs auront ces champs correctement initialisés
- ✅ Les joueurs existants seront mis à jour lors du prochain démarrage

## Fichiers Modifiés

1. `Arena_back/src/controllers/auth.controller.js` (2 modifications)
2. `Arena_back/src/controllers/gameData.controller.js` (1 modification)
3. `Arena_back/fix-player-balances.js` (nouveau fichier)
4. `Arena_back/package.json` (nouveau script)

## Support

Si le problème persiste après ces corrections:

1. Vérifier les logs du serveur lors du démarrage
2. Exécuter le script `pnpm run fix:player-balances`
3. Vérifier la réponse de l'API `/api/auth/login` avec un client comme Postman
4. Vérifier les logs de l'application mobile
