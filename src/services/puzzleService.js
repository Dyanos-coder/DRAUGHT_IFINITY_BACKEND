const { getPuzzleModel } = require('../models/puzzle.model');

// Incrémenter à chaque évolution de la logique de génération → les puzzles
// d'une version antérieure seront régénérés automatiquement par le job.
const GENERATOR_VERSION = 2;

const EMPTY = 0, RED = 1, WHITE = 2, RED_KING = 3, WHITE_KING = 4;
const ALL_DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function isRed(p) { return p === RED || p === RED_KING; }
function isWhite(p) { return p === WHITE || p === WHITE_KING; }
function isKing(p) { return p === RED_KING || p === WHITE_KING; }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function cloneBoard(b) { return b.map(r => [...r]); }
function getDirs(piece) {
    if (isKing(piece)) return ALL_DIAGS;
    return isRed(piece) ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function getCaptures(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const caps = [];
    for (const [dr, dc] of getDirs(piece)) {
        const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
        if (!inBounds(lr, lc) || board[lr][lc]) continue;
        const mid = board[mr][mc];
        if (mid && ((isRed(piece) && isWhite(mid)) || (isWhite(piece) && isRed(mid)))) {
            caps.push({ from: { row: r, col: c }, to: { row: lr, col: lc }, captured: { row: mr, col: mc } });
        }
    }
    return caps;
}

function getAllCaptures(board, forRed) {
    const caps = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if ((forRed && isRed(p)) || (!forRed && isWhite(p))) caps.push(...getCaptures(board, r, c));
    }
    return caps;
}

function getMoves(board, forRed) {
    const caps = getAllCaptures(board, forRed);
    if (caps.length) return caps;
    const moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if ((forRed && isRed(p)) || (!forRed && isWhite(p))) {
            for (const [dr, dc] of getDirs(p)) {
                const nr = r + dr, nc = c + dc;
                if (inBounds(nr, nc) && !board[nr][nc]) moves.push({ from: { row: r, col: c }, to: { row: nr, col: nc } });
            }
        }
    }
    return moves;
}

function applyMove(board, move) {
    const b = cloneBoard(board);
    const piece = b[move.from.row][move.from.col];
    b[move.to.row][move.to.col] = piece;
    b[move.from.row][move.from.col] = EMPTY;
    if (move.captured) b[move.captured.row][move.captured.col] = EMPTY;
    if (isRed(piece) && move.to.row === 0) b[move.to.row][move.to.col] = RED_KING;
    if (isWhite(piece) && move.to.row === 7) b[move.to.row][move.to.col] = WHITE_KING;
    return b;
}

function findCombination(board) {
    // Cherche : coup Rouge tranquille (sacrifice) → capture Blanche FORCÉE →
    // rafle Rouge gagnante. Tout DOIT être forcé après le 1er coup, sinon le
    // joueur (capture obligatoire) pourrait jouer une capture légale différente
    // de la solution et être marqué à tort "mauvais coup".
    const redMoves = getMoves(board, true);
    if (!redMoves.length) return null;

    let bestCombo = null;

    for (const rMove of redMoves) {
        // Le 1er coup est la SEULE décision : un coup tranquille (sacrifice).
        if (rMove.captured) continue;

        const b1 = applyMove(board, rMove);

        // Réponse Blanche : exactement UNE capture d'entrée ET chaîne non
        // branchante (donc entièrement forcée et reproductible par le client).
        const whiteCaps = getAllCaptures(b1, false);
        if (whiteCaps.length !== 1) continue;
        const wChain = findForcedRafle(b1, whiteCaps[0]);
        if (!wChain) continue; // chaîne blanche ambiguë → rejetée

        let b2 = cloneBoard(b1);
        for (const wMove of wChain) {
            b2 = applyMove(b2, wMove);
        }

        // Rafle Rouge : exactement UNE capture d'entrée ET chaîne non branchante
        // → aucune ambiguïté, toute capture obligatoire du joueur est la bonne.
        const redCaps2 = getAllCaptures(b2, true);
        if (redCaps2.length !== 1) continue;
        const rChain2 = findForcedRafle(b2, redCaps2[0]);
        if (!rChain2) continue;

        // Vrai gain : Rouge reprend STRICTEMENT plus que ce que Blanc a capturé.
        if (rChain2.length >= 2 && rChain2.length > wChain.length) {
            if (!bestCombo || rChain2.length > bestCombo.finalChain.length) {
                bestCombo = {
                    firstMove: rMove,
                    whiteChain: wChain,
                    finalChain: rChain2
                };
            }
        }
    }
    return bestCombo;
}

// Suit une rafle Rouge en exigeant qu'elle soit NON AMBIGUË : à chaque saut,
// une seule continuation possible. Renvoie null si une branche apparaît (sinon
// le joueur pourrait diverger de la solution stockée → faux échec).
function findForcedRafle(board, cap) {
    const chain = [{ from: cap.from, to: cap.to, captured: cap.captured }];
    let b = applyMove(board, cap);
    let pos = cap.to;
    for (let i = 0; i < 8; i++) {
        const nexts = getCaptures(b, pos.row, pos.col);
        if (nexts.length === 0) break;
        if (nexts.length > 1) return null; // branche → ambigu
        chain.push({ from: nexts[0].from, to: nexts[0].to, captured: nexts[0].captured });
        b = applyMove(b, nexts[0]);
        pos = nexts[0].to;
    }
    return chain;
}

// Puzzle "easy" : Rouge dispose d'UNE seule capture (donc obligatoire et sans
// choix) qui enchaîne une rafle forcée d'au moins 2 prises. Le joueur doit
// repérer et exécuter correctement la rafle multiple.
function findRafle(board) {
    const caps = getAllCaptures(board, true);
    if (caps.length !== 1) return null; // une seule entrée de capture → zéro ambiguïté
    const chain = findForcedRafle(board, caps[0]);
    if (!chain || chain.length < 2) return null;
    return chain;
}

function generateStartBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = WHITE;
    for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = RED;
    return board;
}

function normalizeDate(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Construit un candidat (rafle ou combinaison) à partir d'une position où Rouge
// est au trait. Renvoie null si aucune tactique exploitable n'est présente.
function buildCandidate(board) {
    // Cas 1 : Rouge a une capture → puzzle de rafle (easy).
    const rafle = findRafle(board);
    if (rafle) {
        return {
            board,
            difficulty: 'easy',
            theme: 'rafle',
            coinReward: 15,
            solutionMoves: rafle.map(m => ({ player: 'red', from: m.from, to: m.to })),
        };
    }
    // Cas 2 : pas de capture immédiate → combinaison avec sacrifice (medium/hard).
    const combo = findCombination(board);
    if (combo) {
        const isHard = combo.finalChain.length >= 3;
        return {
            board,
            difficulty: isHard ? 'hard' : 'medium',
            theme: 'combo',
            coinReward: isHard ? 50 : 30,
            solutionMoves: [
                { player: 'red', from: combo.firstMove.from, to: combo.firstMove.to },
                ...combo.whiteChain.map(m => ({ player: 'white', from: m.from, to: m.to })),
                ...combo.finalChain.map(m => ({ player: 'red', from: m.from, to: m.to })),
            ],
        };
    }
    return null;
}

// `connection` = connexion à la BD DU JEU (cf. gameDatabaseService).
async function generatePuzzleForDate(connection, gameId, date, gameType = 'english') {
    // Difficulté cible tournante par date → variété garantie sur la semaine
    // (et déterministe : régénérer la même date vise la même difficulté).
    const epochDay = Math.floor(normalizeDate(date).getTime() / 86400000);
    const target = ['easy', 'medium', 'hard'][epochDay % 3];

    let fallback = null;
    for (let attempt = 0; attempt < 400; attempt++) {
        let board = generateStartBoard();
        let redTurn = true;
        const n = 15 + Math.floor(Math.random() * 20); // parties plus profondes = plus de tactiques
        for (let i = 0; i < n; i++) {
            const moves = getMoves(board, redTurn);
            if (!moves.length) break;
            board = applyMove(board, moves[Math.floor(Math.random() * moves.length)]);
            redTurn = !redTurn;
        }

        if (redTurn === false) continue; // on veut Rouge au trait

        const candidate = buildCandidate(board);
        if (!candidate) continue;

        // On privilégie la difficulté cible ; sinon on garde le 1er candidat
        // valide comme repli pour toujours produire un puzzle.
        if (candidate.difficulty === target) {
            return await saveCandidate(connection, gameId, date, gameType, candidate);
        }
        if (!fallback) fallback = candidate;
    }

    if (fallback) return await saveCandidate(connection, gameId, date, gameType, fallback);
    throw new Error('Could not generate a valid puzzle after 400 attempts');
}

async function saveCandidate(connection, gameId, date, gameType, c) {
    const Puzzle = getPuzzleModel(connection);
    const d = new Date(date);
    const prefixes = { rafle: 'Rafle du', combo: 'Combinaison du', promotion: 'Promotion du' };
    const title = `${prefixes[c.theme] || 'Défi du'} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

    const puzzle = new Puzzle({
        gameId, date: normalizeDate(date), gameType,
        board: c.board, playerColor: 'red', solutionMoves: c.solutionMoves,
        difficulty: c.difficulty, theme: c.theme, title,
        coinReward: c.coinReward, generatorVersion: GENERATOR_VERSION,
    });
    await puzzle.save();
    return puzzle;
}

// ── Validation serveur ──────────────────────────────────────────────────
// Le client n'a jamais la solution : il soumet la liste des coups joués.
// On ne compare QUE les coups du joueur (Rouge) à ceux de la solution ; les
// coups Blancs sont forcés (recalculés à l'identique) donc non déterminants.
function sameSquare(a, b) {
    return a && b
        && Number(a.row) === Number(b.row)
        && Number(a.col) === Number(b.col);
}

function validateSolution(puzzle, submittedMoves) {
    if (!Array.isArray(submittedMoves)) return false;
    const solRed = (puzzle.solutionMoves || []).filter(m => m.player === 'red');
    const subRed = submittedMoves.filter(m => m && m.player === 'red');
    if (subRed.length !== solRed.length || solRed.length === 0) return false;
    for (let i = 0; i < solRed.length; i++) {
        if (!sameSquare(solRed[i].from, subRed[i].from)) return false;
        if (!sameSquare(solRed[i].to, subRed[i].to)) return false;
    }
    return true;
}

// Nouvel objectif : BATTRE l'adversaire. Le joueur (Rouge) a gagné si Blanc,
// au trait, n'a plus aucun coup légal et que Rouge possède encore une pièce.
// `board` = grille 8x8 d'entiers (0=vide,1=rouge,2=blanc,3=roiR,4=roiB).
function validateWin(board) {
    if (!Array.isArray(board) || board.length !== 8) return false;
    let redExists = false;
    for (let r = 0; r < 8; r++) {
        if (!Array.isArray(board[r]) || board[r].length !== 8) return false;
        for (let c = 0; c < 8; c++) if (isRed(board[r][c])) redExists = true;
    }
    if (!redExists) return false;
    return getMoves(board, false).length === 0; // Blanc ne peut plus jouer
}

// Garantit les puzzles AUTOUR d'aujourd'hui dans la BD DU JEU : back-fill des
// jours passés ET pré-génération des jours à venir, pour que le puzzle du jour
// soit toujours prêt (même sans visite) et que celui de demain existe avant
// minuit UTC. `connection` = connexion à la BD du jeu.
async function ensureDailyPuzzles(connection, gameId, { pastDays = 5, futureDays = 1 } = {}) {
    const Puzzle = getPuzzleModel(connection);
    const today = new Date();
    for (let offset = -futureDays; offset <= pastDays; offset++) {
        const day = new Date(today);
        day.setUTCDate(today.getUTCDate() - offset); // offset < 0 → jour futur
        const norm = normalizeDate(day);
        const label = norm.toISOString().split('T')[0];

        const existing = await Puzzle.findOne({ gameId, date: norm });
        // Un puzzle est VALIDE s'il a des coups Rouges avec `player` ET provient
        // de la version courante du générateur. Sinon (champ `player` perdu, ou
        // logique de génération obsolète/ambiguë) on le remplace.
        const isValid = existing
            && Array.isArray(existing.solutionMoves)
            && existing.solutionMoves.some(m => m && m.player === 'red')
            && existing.generatorVersion === GENERATOR_VERSION;

        if (existing && isValid) continue;

        try {
            if (existing) {
                await Puzzle.deleteOne({ _id: existing._id });
                console.log('\x1b[33m%s\x1b[0m', `♻️ Puzzle invalide remplacé pour ${label}`);
            }
            await generatePuzzleForDate(connection, gameId, norm);
            console.log('\x1b[32m%s\x1b[0m', `✅ Puzzle généré pour ${label}`);
        } catch (e) {
            console.error('\x1b[31m%s\x1b[0m', `❌ Erreur puzzle ${label}: ${e.message}`);
        }
    }
}

module.exports = { generatePuzzleForDate, ensureDailyPuzzles, normalizeDate, validateSolution, validateWin };
