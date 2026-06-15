const { MongoClient } = require('mongodb');

// J'AI ENLEVÉ LE "+srv" ET LISTÉ VOS 3 SERVEURS DIRECTEMENT
const uri = "mongodb://sannicharbel_db_user:sABKSwyj3q5fM6TP@ac-aiw6lel-shard-00-00.remphlk.mongodb.net:27017,ac-aiw6lel-shard-00-01.remphlk.mongodb.net:27017,ac-aiw6lel-shard-00-02.remphlk.mongodb.net:27017/?ssl=true&replicaSet=atlas-aiw6lel-shard-0&authSource=admin&retryWrites=true&w=majority";

const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Tentative de connexion directe...");
    await client.connect();
    console.log("✅ ENFIN ! Connexion réussie via le code !");
  } catch (err) {
    console.error("❌ Erreur persistante :", err);
  } finally {
    await client.close();
  }
}
run();