const { normalizeDate, validateWin } = require('../services/puzzleService');
const { getPuzzleModel } = require('../models/puzzle.model');
const gameDatabaseService = require('../services/gameDatabaseService');

// Récupère le contexte d'accès aux puzzles : connexion à la BD DU JEU, modèle
// Puzzle lié à cette connexion, et l'identité du joueur DANS le jeu (Player._id).
// Les puzzles et les soldes vivent dans la BD du jeu, pas dans l'arène.
async function resolveGameContext(req) {
    const { gameId } = req.params;
    const connection = gameDatabaseService.getGameConnection(gameId);
    if (!connection) {
        return { error: { status: 503, message: 'Base de données du jeu indisponible' } };
    }
    const Puzzle = getPuzzleModel(connection);

    // Token Player (mobile) → playerId direct. Token User (web) → Player lié.
    let playerId = req.user?.playerId?.toString();
    if (!playerId) {
        const arenaUserId = (req.user?._id ?? req.user?.id)?.toString();
        if (arenaUserId) {
            const Player = connection.model('Player');
            const p = await Player.findOne({ userId: arenaUserId }).select('_id');
            playerId = p?._id?.toString();
        }
    }
    return { connection, Puzzle, playerId };
}

exports.getCalendar = async (req, res) => {
    try {
        const { gameId } = req.params;
        const ctx = await resolveGameContext(req);
        if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
        if (!ctx.playerId) return res.status(401).json({ success: false, message: 'Non authentifié' });
        const { Puzzle, playerId } = ctx;

        // La génération est gérée par un job planifié côté serveur — plus de
        // génération paresseuse ici (évite des requêtes répétées à chaque ouverture).
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 30);
        since.setUTCHours(0, 0, 0, 0);

        const puzzles = await Puzzle.find({ gameId, date: { $gte: since } })
            .select('date difficulty theme title coinReward solvedBy')
            .sort({ date: -1 });

        const calendar = puzzles.map(p => ({
            date: p.date.toISOString().split('T')[0],
            difficulty: p.difficulty,
            theme: p.theme,
            title: p.title,
            coinReward: p.coinReward,
            solved: (p.solvedBy || []).some(id => id?.toString() === playerId),
            puzzleId: p._id,
        }));

        res.json({ success: true, calendar });
    } catch (e) {
        console.error('getCalendar error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getPuzzleByDate = async (req, res) => {
    try {
        const { gameId, date } = req.params;
        const ctx = await resolveGameContext(req);
        if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
        const { Puzzle, playerId } = ctx;

        const normalized = normalizeDate(new Date(date));
        const puzzle = await Puzzle.findOne({ gameId, date: normalized });
        if (!puzzle) return res.status(404).json({ success: false, message: 'Puzzle non trouvé' });

        const solved = (puzzle.solvedBy || []).some(id => id?.toString() === playerId);

        // Objectif : battre l'adversaire (IA) depuis cette position. On envoie
        // juste la position de départ et la récompense ; pas de solution.
        res.json({
            success: true,
            puzzle: {
                _id: puzzle._id,
                date: puzzle.date,
                gameType: puzzle.gameType,
                board: puzzle.board,
                playerColor: puzzle.playerColor,
                difficulty: puzzle.difficulty,
                theme: puzzle.theme,
                title: puzzle.title,
                coinReward: puzzle.coinReward,
                solved,
            }
        });
    } catch (e) {
        console.error('getPuzzleByDate error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.solvePuzzle = async (req, res) => {
    try {
        const { gameId, puzzleId } = req.params;
        const { board } = req.body; // position finale (Blanc au trait, sans coup)

        const ctx = await resolveGameContext(req);
        if (ctx.error) return res.status(ctx.error.status).json({ success: false, message: ctx.error.message });
        if (!ctx.playerId) return res.status(401).json({ success: false, message: 'Non authentifié' });
        const { connection, Puzzle, playerId } = ctx;

        const puzzle = await Puzzle.findOne({ _id: puzzleId, gameId });
        if (!puzzle) return res.status(404).json({ success: false, message: 'Puzzle non trouvé' });

        if ((puzzle.solvedBy || []).some(id => id?.toString() === playerId)) {
            return res.json({ success: true, alreadySolved: true, won: true, message: 'Déjà gagné !' });
        }

        // Objectif : battre l'adversaire. On vérifie côté serveur que la position
        // finale est bien une victoire Rouge (Blanc ne peut plus jouer).
        if (!validateWin(board)) {
            return res.json({ success: true, won: false, message: "La partie n'est pas encore gagnée." });
        }

        // Victoire : récompense pleine, créditée sur le Player de la BD du jeu.
        const reward = puzzle.coinReward || 0;
        puzzle.solvedBy.push(playerId);
        await puzzle.save();

        let newBalance = null;
        const Player = connection.model('Player');
        const player = await Player.findById(playerId);
        if (player) {
            player.soldePiece = (player.soldePiece || 0) + reward;
            await player.save();
            newBalance = player.soldePiece;
        }

        res.json({
            success: true,
            won: true,
            coinReward: reward,
            newBalance,
            message: `🏆 Victoire ! +${reward} pièces gagnées !`
        });
    } catch (e) {
        console.error('solvePuzzle error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
};
