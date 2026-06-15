const mongoose = require('mongoose');
const { Schema } = mongoose;

// Un coup de la solution : inclut OBLIGATOIREMENT `player` (red/white), sinon
// Mongoose le supprimerait au save (mode strict) et la validation serveur
// — qui filtre sur m.player === 'red' — échouerait systématiquement.
const solutionMoveSchema = new Schema({
    player: { type: String, enum: ['red', 'white'] },
    from: { row: Number, col: Number },
    to: { row: Number, col: Number },
}, { _id: false });

const puzzleSchema = new Schema({
    // Conservé pour le filtrage/cohérence, même si chaque BD de jeu ne contient
    // que ses propres puzzles. (Pas de ref : la collection vit dans la BD du jeu.)
    gameId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true }, // Normalisé à minuit UTC
    gameType: {
        type: String,
        enum: ['english', 'russian', 'brazilian', 'turkish', 'italian'],
        default: 'english'
    },
    board: { type: Schema.Types.Mixed, required: true }, // 8x8: 0=vide,1=rouge,2=blanc,3=roiRouge,4=roiBlanc
    playerColor: { type: String, enum: ['red', 'white'], default: 'red' },
    solutionMoves: [solutionMoveSchema],
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    // Type de tactique du puzzle (sert au libellé et, plus tard, au filtrage).
    theme: { type: String, enum: ['rafle', 'combo', 'promotion'], default: 'combo' },
    title: { type: String, default: '' },
    coinReward: { type: Number, default: 10 },
    // Version du générateur ayant produit ce puzzle. Permet de régénérer
    // automatiquement les puzzles obsolètes quand la logique évolue.
    generatorVersion: { type: Number, default: 0 },
    // Identités des joueurs du JEU (Player._id de la BD du jeu), pas des User arène.
    solvedBy: [{ type: Schema.Types.ObjectId }],
    // Tentatives échouées par joueur (décompte des essais + décroissance de la
    // récompense, décidés exclusivement côté serveur).
    attempts: [{
        _id: false,
        user: { type: Schema.Types.ObjectId },
        fails: { type: Number, default: 0 },
    }],
}, { timestamps: true });

puzzleSchema.index({ gameId: 1, date: 1 });

// Le Puzzle vit dans la BD DU JEU (connexion dédiée fournie par
// gameDatabaseService), PAS dans la BD arène (connexion mongoose par défaut).
// On lie donc le modèle à la connexion du jeu passée en argument.
function getPuzzleModel(connection) {
    return connection.models.Puzzle || connection.model('Puzzle', puzzleSchema);
}

module.exports = { puzzleSchema, getPuzzleModel };
