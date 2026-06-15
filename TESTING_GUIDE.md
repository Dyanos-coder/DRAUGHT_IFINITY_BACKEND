# 🧪 Guide de Test - Système de Bases de Données par Jeu

## 🎯 Objectif

Ce guide vous accompagne pas à pas pour tester le nouveau système de bases de données dédiées par jeu.

---

## 📋 Prérequis

- ✅ Node.js installé
- ✅ MongoDB accessible
- ✅ Variables d'environnement configurées (`.env`)
- ✅ Dépendances installées (`npm install`)

---

## 🚀 Test 1 : Test Automatique Complet

### Commande
```bash
npm run test:game-db
```

### Ce que fait ce test :
1. Se connecte à MongoDB
2. Crée un jeu de test
3. Crée sa base de données dédiée
4. Initialise les collections
5. Insère des données de test
6. Vérifie les métadonnées
7. Affiche les statistiques
8. Nettoie (supprime le jeu de test)

### Résultat attendu :
```
🧪 Démarrage des tests du système de bases de données par jeu...

📡 Connexion à MongoDB...
✅ Connecté à MongoDB

📦 Création d'un jeu de test...
✅ Jeu créé: Test Game 1699... (ID: 673...)

🔨 Création de la base de données pour le jeu...
✅ Base de données créée: game_test_game_673...

🔍 Vérification de la connexion...
✅ Connexion active: true

📋 Initialisation des collections pour Test Game...
✅ Collections créées:
   - players
   - matches
   - statistics
   - metadata

💾 Test d'insertion de données...
✅ Joueur créé: TestPlayer123

🔍 Vérification des métadonnées...
✅ Métadonnées trouvées:
   - Jeu: Test Game 1699...
   - Version: 1.0.0
   - Créé le: 2025-11-07...

📈 Statistiques de la base de données...
✅ Statistiques:
   - Collections: 4
   - Taille des données: 1024 bytes
   - Taille des index: 512 bytes

🎉 Tous les tests ont réussi !
```

---

## 🔍 Test 2 : Vérification des Jeux Existants

### Commande
```bash
npm run verify:game-db
```

### Ce que fait ce test :
1. Se connecte à MongoDB
2. Récupère tous les jeux existants
3. Vérifie si chaque jeu a une base de données
4. Crée les bases manquantes
5. Affiche un rapport détaillé

### Résultat attendu :
```
🔍 Vérification des bases de données des jeux...

📡 Connexion à MongoDB...
✅ Connecté à MongoDB

============================================================
📊 RÉSULTATS DE LA VÉRIFICATION
============================================================

📈 Statistiques:
   Total de jeux: 3
   Bases créées: 2
   Bases existantes: 1
   Erreurs: 0

📋 Détails par jeu:

   1. 🆕 EA FC 25
      ID: 673c5e8a9f1b2c3d4e5f6a7b
      Status: CRÉÉE
      Base de données: game_ea_fc_25_673c5e8a

   2. 🆕 Call of Duty
      ID: 673c5e8b9f1b2c3d4e5f6a7c
      Status: CRÉÉE
      Base de données: game_call_of_duty_673c5e8b

   3. ✅ FIFA 23
      ID: 673c5e8c9f1b2c3d4e5f6a7d
      Status: EXISTANTE
      Base de données: game_fifa_23_673c5e8c

============================================================

✨ 2 nouvelle(s) base(s) de données créée(s) avec succès !

🎉 Toutes les bases de données sont opérationnelles !
```

---

## 🌐 Test 3 : Test via l'API

### 3.1 Créer un Jeu (et sa base de données auto)

```bash
# D'abord, obtenir un token admin
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@arena.com",
    "password": "votre_mot_de_passe"
  }'

# Sauvegarder le token reçu, puis créer un jeu
curl -X POST http://localhost:5000/api/games \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Game API",
    "description": "Jeu créé via API pour tester",
    "category": "sport",
    "publisher": "Test Publisher",
    "status": "development"
  }'
```

**Résultat attendu** :
```json
{
  "success": true,
  "message": "Jeu créé avec succès",
  "game": {
    "_id": "673...",
    "name": "Test Game API",
    "databaseName": "game_test_game_api_673...",
    "databaseCreatedAt": "2025-11-07T10:30:00.000Z",
    ...
  }
}
```

### 3.2 Vérifier les Bases de Données

```bash
curl -X POST http://localhost:5000/api/games/databases/verify \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

**Résultat attendu** :
```json
{
  "success": true,
  "message": "Vérification des bases de données terminée",
  "results": {
    "total": 4,
    "created": 1,
    "existing": 3,
    "errors": [],
    "details": [...]
  }
}
```

### 3.3 Obtenir les Infos d'une Base de Données

```bash
curl http://localhost:5000/api/games/GAME_ID/database/info \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

**Résultat attendu** :
```json
{
  "success": true,
  "gameId": "673...",
  "gameName": "Test Game API",
  "databaseName": "game_test_game_api_673...",
  "databaseCreatedAt": "2025-11-07T10:30:00.000Z",
  "hasActiveConnection": true,
  "collections": ["players", "matches", "statistics", "metadata"],
  "stats": {
    "collections": 4,
    "dataSize": 1024,
    "indexSize": 512,
    "totalSize": 1536
  }
}
```

---

## 🖥️ Test 4 : Test au Démarrage du Serveur

### Commande
```bash
npm run dev
```

### Logs à surveiller :
```
✅ Connecté à MongoDB
✅ Base de données initialisée avec succès
✅ Admin initialisé avec succès
✅ Substitute players check complete.
🔍 Vérification des bases de données des jeux...
📦 Création de la base de données pour le jeu: EA FC 25
📦 Nom de la DB: game_ea_fc_25_673c5e8a
✅ Connexion établie pour game_ea_fc_25_673c5e8a
📋 Initialisation des collections pour EA FC 25...
✅ Collections initialisées pour EA FC 25
✅ Base de données créée avec succès pour EA FC 25
   📊 Résumé:
      Total de jeux: 3
      Bases créées: 1
      Bases existantes: 2
      Erreurs: 0
✅ Bases de données des jeux vérifiées
🚀 Serveur démarré sur le port 5000
```

---

## 🔬 Test 5 : Test MongoDB Direct

### Ouvrir MongoDB Compass ou mongosh

```bash
mongosh "VOTRE_MONGODB_URI"
```

### Vérifier les bases de données créées :

```javascript
// Lister toutes les bases de données
show dbs

// Vous devriez voir :
// game_ea_fc_25_673c5e8a
// game_call_of_duty_673c5e8b
// game_fifa_23_673c5e8c

// Se connecter à une base de jeu
use game_ea_fc_25_673c5e8a

// Lister les collections
show collections
// Résultat attendu: players, matches, statistics, metadata

// Vérifier les métadonnées
db.metadata.findOne()

// Vérifier les index
db.players.getIndexes()
```

---

## ✅ Checklist de Test

Cochez chaque élément après l'avoir testé :

### Tests Automatiques
- [ ] `npm run test:game-db` passe sans erreur
- [ ] `npm run verify:game-db` trouve tous les jeux
- [ ] Logs de démarrage affichent la vérification des BDs

### Tests API
- [ ] Création d'un jeu crée automatiquement sa BD
- [ ] `POST /api/games/databases/verify` fonctionne
- [ ] `GET /api/games/:id/database/info` retourne les infos
- [ ] `POST /api/games/:id/database` crée une BD manuellement
- [ ] `DELETE /api/games/:id/database` supprime une BD

### Tests MongoDB
- [ ] Les bases de jeux sont visibles dans MongoDB
- [ ] Chaque base a les 4 collections attendues
- [ ] Les métadonnées sont correctes
- [ ] Les index sont créés

### Tests de Données
- [ ] Insertion de joueurs fonctionne
- [ ] Insertion de matchs fonctionne
- [ ] Récupération de données fonctionne
- [ ] Statistiques sont calculées correctement

---

## 🐛 Dépannage

### Problème : "Base de données non créée"

**Solution** :
```bash
# Vérifier la connexion MongoDB
npm run verify:game-db

# Ou créer manuellement
curl -X POST http://localhost:5000/api/games/GAME_ID/database \
  -H "Authorization: Bearer TOKEN"
```

### Problème : "Trop de connexions"

**Solution** :
- Vérifier le nombre de jeux : `show dbs` dans mongosh
- Vérifier votre plan MongoDB (limite de connexions)
- Redémarrer le serveur pour réinitialiser les connexions

### Problème : "Erreur lors de la création"

**Vérifier** :
1. MongoDB URI est correcte
2. Vous avez les permissions
3. Le nom du jeu est valide
4. Il n'y a pas de conflit de nom de base

---

## 📊 Tests de Performance

### Test de Charge

```javascript
// Créer 100 jeux et leurs bases de données
for (let i = 0; i < 100; i++) {
  await fetch('/api/games', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `Game ${i}`,
      description: 'Test',
      category: 'sport',
      publisher: 'Test'
    })
  });
}
```

**Métriques à surveiller** :
- Temps de création par jeu
- Nombre de connexions actives
- Utilisation mémoire
- Temps de réponse des APIs

---

## 🎓 Validation Finale

Pour valider que tout fonctionne :

1. ✅ Exécuter `npm run test:game-db` → Tous les tests passent
2. ✅ Créer un jeu via l'API → BD créée automatiquement
3. ✅ Vérifier dans MongoDB → Base et collections présentes
4. ✅ Insérer des données → Données persistées correctement
5. ✅ Redémarrer le serveur → Connexions rétablies

---

## 📝 Rapport de Test

Après avoir effectué tous les tests, remplir :

```
Date du test : ___________
Testeur : ___________

Résultats :
- Tests automatiques : ☐ Réussi ☐ Échoué
- Tests API : ☐ Réussi ☐ Échoué
- Tests MongoDB : ☐ Réussi ☐ Échoué
- Tests de données : ☐ Réussi ☐ Échoué

Problèmes rencontrés :
_________________________________
_________________________________

Recommandations :
_________________________________
_________________________________

Statut final : ☐ Validé ☐ À revoir
```

---

## 🎉 Félicitations !

Si tous les tests sont passés, le système est prêt pour la production ! 🚀

---

**Prochaines étapes** :
1. Déployer en production
2. Configurer le monitoring
3. Former l'équipe
4. Documenter les procédures opérationnelles
