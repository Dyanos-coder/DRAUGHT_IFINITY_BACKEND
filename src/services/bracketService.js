const Match = require('../models/match.model');
const Tournament = require('../models/tournament.model');
const User = require('../models/user.model');
const Reward = require('../models/reward.model');
const mongoose = require('mongoose');

/**
 * Calcule le nombre de tours nécessaires pour un nombre donné de participants
 * @param {number} numPlayers - Nombre de participants
 * @returns {number} - Nombre de tours nécessaires
 */
function calculateNumberOfRounds(numPlayers) {
  return Math.ceil(Math.log2(numPlayers));
}

/**
 * Calcule le nombre de "bye" nécessaires pour atteindre la prochaine puissance de 2
 * @param {number} numPlayers - Nombre de participants
 * @returns {number} - Nombre de "bye" nécessaires
 */
function calculateNumberOfByes(numPlayers) {
  const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  return nextPowerOfTwo - numPlayers;
}

/**
 * Mélange un tableau de manière aléatoire (algorithme de Fisher-Yates)
 * @param {Array} array - Tableau à mélanger
 * @returns {Array} - Tableau mélangé
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper function to generate a random string (match code)
function generateMatchCode(minLength = 15, maxLength = 31) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const charactersLength = characters.length;
  // Generate a random length between minLength and maxLength (inclusive)
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Helper function to generate a random time string (HH:MM) between 09:00 and 18:00
function getRandomTime() {
  return "20:00";
}

/**
 * Fetches an available substitute player who is not already in the given list of player IDs.
 * @param {Array<string>} activePlayerIds - IDs of players already in the tournament.
 * @returns {Promise<User|null>} - A substitute player document or null.
 */
async function getAvailableSubstitute(activePlayerIds = []) {
  try {
    // Find substitute players not already in the current tournament's player list
    const substitutes = await User.find({
      isSubstitute: true,
      role: 'substitute',
      _id: { $nin: activePlayerIds.map(id => new mongoose.Types.ObjectId(id)) } // Exclude active players
    });

    if (substitutes.length === 0) {
      console.warn('[BracketService] No available substitute players found (all might be in use or none exist).');
      return null;
    }

    // Pick one randomly for now
    const randomIndex = Math.floor(Math.random() * substitutes.length);
    return substitutes[randomIndex];
  } catch (error) {
    console.error('[BracketService] Error fetching available substitute:', error);
    return null;
  }
}

/**
 * Génère les matchs du premier tour avec les "bye"
 * @param {string} tournamentId - ID du tournoi
 * @param {Array<string>} playerIds - IDs des joueurs
 * @returns {Promise<Array>} - Tableau des matchs créés
 */
async function generateFirstRoundMatches(tournamentId, playerIds) {
  const numPlayers = playerIds.length;
  let numByes = calculateNumberOfByes(numPlayers);
  let effectivePlayerIds = [...playerIds]; // Copy of player IDs to potentially add substitutes

  console.log(`[BracketService] Initial players: ${numPlayers}, Byes needed: ${numByes}`);
  
  // Attempt to fill byes with substitute players
  if (numByes > 0) {
    console.log(`[BracketService] Attempting to fill ${numByes} bye(s) with substitutes.`);
  for (let i = 0; i < numByes; i++) {
      const substitute = await getAvailableSubstitute(effectivePlayerIds);
      if (substitute) {
        console.log(`[BracketService] Found substitute: ${substitute.username} (${substitute._id})`);
        effectivePlayerIds.push(substitute._id.toString());
      } else {
        console.warn('[BracketService] Could not find an available substitute for a bye slot.');
        // If no substitute found, this slot will remain a true bye
        effectivePlayerIds.push(null); // Add a null to keep pairing logic consistent
        break; // Stop trying to find more substitutes if one can't be found (or adjust logic)
      }
    }
  }
   // Recalculate total matches based on potentially increased player count due to substitutes
  const finalPlayerCount = effectivePlayerIds.filter(p => p !== null).length;
  const totalFirstRoundMatches = Math.ceil(finalPlayerCount / 2);
  console.log(`[BracketService] Effective players after substitutes (or byes): ${finalPlayerCount}`);

  // Mélanger les joueurs de manière aléatoire (including nulls if true byes remain)
  const shuffledPlayers = shuffleArray(effectivePlayerIds);

  const matches = [];
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Supprimer d'abord tous les matchs existants pour ce tournoi
      await Match.deleteMany({ tournamentId }).session(session);

      // Date de demain pour les matchs du premier tour
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tournament = await Tournament.findById(tournamentId);
      const matchTime = tournament.matchTime || "20:00";

      // Créer les matchs du premier tour
      for (let i = 0; i < totalFirstRoundMatches; i++) {
        const player1 = shuffledPlayers[i * 2];
        const player2 = shuffledPlayers[i * 2 + 1];
        
        const matchData = {
          tournamentId,
          round: 1,
          matchNumber: i + 1,
          date: tomorrow, // Date: Demain
          time: matchTime, // Heure du tournoi
          matchCode: generateMatchCode(),
          player1Score: null, // Score initial
          player2Score: null, // Score initial
          bracketPosition: {
            x: 0,
            y: i
          }
        };

        // Gérer les cas de "bye"
        if (!player1 || !player2) { // This condition now means a true bye (no substitute was found or available)
          matchData.status = 'bye';
          matchData.isBye = true;
          // Assign the player that is not null as the winner of the bye
          const presentPlayer = player1 || player2;
          matchData.players = presentPlayer ? [presentPlayer] : [];
          matchData.winner = presentPlayer;
          console.log(`[BracketService] Created BYE match for player: ${presentPlayer}`);
        } else {
          matchData.status = 'pending';
          matchData.players = [player1, player2];
          console.log(`[BracketService] Created match between: ${player1} and ${player2}`);
        }

        const match = new Match(matchData);
        await match.save({ session });
        matches.push(match);
      }

      // Générer les tours suivants
      let currentRound = 1;
      let currentRoundMatches = matches;
      
      while (currentRoundMatches.length > 1) {
        const nextRoundMatches = [];
        const numNextRoundMatches = Math.ceil(currentRoundMatches.length / 2);
        
        for (let i = 0; i < numNextRoundMatches; i++) {
          // Date pour les tours suivants (peut être ajustée plus tard)
          // Pour l'instant, mettons aussi à demain + round pour une simple différenciation
          const nextMatchDate = new Date();
          nextMatchDate.setDate(nextMatchDate.getDate() + 1 + currentRound);

          const matchData = {
            tournamentId,
            round: currentRound + 1,
            matchNumber: i + 1,
            date: nextMatchDate, // Date pour les tours suivants
            time: matchTime, // Heure du tournoi
            matchCode: generateMatchCode(),
            player1Score: null,
            player2Score: null,
            status: 'pending',
            bracketPosition: {
              x: currentRound,
              y: i
            },
            players: [],
            previousMatches: [
              currentRoundMatches[i * 2]?._id,
              currentRoundMatches[i * 2 + 1]?._id
            ].filter(Boolean)
          };

          const match = new Match(matchData);
          await match.save({ session });
          nextRoundMatches.push(match);

          // Mettre à jour les matchs précédents avec l'ID du prochain match
          if (currentRoundMatches[i * 2]) {
            currentRoundMatches[i * 2].nextMatchId = match._id;
            await currentRoundMatches[i * 2].save({ session });
          }
          if (currentRoundMatches[i * 2 + 1]) {
            currentRoundMatches[i * 2 + 1].nextMatchId = match._id;
            await currentRoundMatches[i * 2 + 1].save({ session });
          }
        }

        matches.push(...nextRoundMatches);
        currentRoundMatches = nextRoundMatches;
        currentRound++;
      }

      // Mettre à jour le tournoi pour indiquer que l'arbre a été généré
      // ET mettre à jour la liste des joueurs et le compte si des substituts ont été ajoutés
      const finalPlayerListForTournament = effectivePlayerIds.filter(pId => pId !== null);
      await Tournament.findByIdAndUpdate(
        tournamentId,
        { 
          $set: { 
            hasGeneratedBracket: true,
            bracketGeneratedAt: new Date(),
            status: 'in-progress',
            players: finalPlayerListForTournament, // Mettre à jour la liste des joueurs du tournoi
            currentParticipants: finalPlayerListForTournament.length // Mettre à jour le compte des participants
          }
        },
        { session }
      );
    });

    return matches;
  } catch (error) {
    console.error('Error in generateFirstRoundMatches:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Génère les matchs du tour suivant
 * @param {string} tournamentId - ID du tournoi
 * @param {number} currentRound - Numéro du tour actuel
 * @returns {Promise<Array>} - Tableau des matchs créés
 */
async function generateNextRoundMatches(tournamentId, currentRound) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const tournament = await Tournament.findById(tournamentId).session(session);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const currentRoundMatches = await Match.find({
        tournamentId,
        round: currentRound,
        status: 'completed'
      }).session(session);

      if (currentRoundMatches.length === 0) {
        throw new Error('No completed matches found for current round');
      }

      const nextRound = currentRound + 1;
      const isSemiFinal = currentRoundMatches.length === 2;
      const isFinal = currentRoundMatches.length === 1;

      // Si c'est la demi-finale, on crée aussi la petite finale
      if (isSemiFinal) {
        const semiFinalLosers = [];
        for (const match of currentRoundMatches) {
          if (match.winner && match.players) {
            const loser = match.players.find(p => p.toString() !== match.winner.toString());
            if (loser) {
              semiFinalLosers.push(loser);
            }
          }
        }

        // Créer la petite finale
        if (semiFinalLosers.length === 2) {
          const thirdPlaceMatch = new Match({
            tournamentId,
            round: nextRound,
            matchNumber: 2, // La finale principale sera le match 1
            players: semiFinalLosers,
            status: 'pending',
            date: new Date(tournament.date),
            time: getRandomTime(),
            bracketPosition: {
              x: nextRound,
              y: 2 // Position en dessous de la finale principale
            }
          });

          await thirdPlaceMatch.save({ session });
          console.log(`[BracketService] Created third place match between ${semiFinalLosers[0]} and ${semiFinalLosers[1]}`);
        }
      }

      // Créer les matchs du prochain tour normal
      const nextRoundMatches = [];
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        if (i + 1 < currentRoundMatches.length) {
          const match1 = currentRoundMatches[i];
          const match2 = currentRoundMatches[i + 1];

          if (match1.winner && match2.winner) {
            const nextMatch = new Match({
              tournamentId,
              round: nextRound,
              matchNumber: Math.floor(i / 2) + 1,
              players: [match1.winner, match2.winner],
              status: 'pending',
              date: new Date(tournament.date),
              time: getRandomTime(),
              bracketPosition: {
                x: nextRound,
                y: Math.floor(i / 2) + 1
              }
            });

            await nextMatch.save({ session });
            nextRoundMatches.push(nextMatch);

            // Mettre à jour les références
            match1.nextMatchId = nextMatch._id;
            match2.nextMatchId = nextMatch._id;
            nextMatch.previousMatches = [match1._id, match2._id];

            await match1.save({ session });
            await match2.save({ session });
          }
        }
      }

      // Mettre à jour le tournoi
      tournament.matches = [...tournament.matches, ...nextRoundMatches.map(m => m._id)];
      await tournament.save({ session });

      return nextRoundMatches;
    });
  } catch (error) {
    console.error('Error in generateNextRoundMatches:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Met à jour un match avec le résultat
 * @param {string} matchId - ID du match
 * @param {object} data - Données de mise à jour (winnerId, player1Score, player2Score, date, time)
 * @returns {Promise<{updatedMatch: object, isTournamentComplete: boolean}>} - Le match mis à jour et si le tournoi est terminé
 */
async function updateMatchResult(matchId, data) {
  const session = await mongoose.startSession();
  try {
    let updatedMatch;
    let isTournamentComplete = false;

    await session.withTransaction(async () => {
      const match = await Match.findById(matchId).session(session);
      if (!match) {
        throw new Error('Match not found');
      }

      // D'abord, récupère le tournoi
      const tournament = await Tournament.findById(match.tournamentId).session(session);

      // Mettre à jour le match
      match.player1Score = data.player1Score;
      match.player2Score = data.player2Score;
      match.status = 'completed';
      match.winner = data.player1Score > data.player2Score ? match.players[0] : match.players[1];
      await match.save({ session });

      updatedMatch = match;

      // Mettre à jour les statistiques des joueurs
      const winnerId = match.winner;
      const loserId = match.players.find(p => p.toString() !== winnerId.toString());

      // Incrémenter les victoires et tournois joués pour le gagnant
      if (winnerId) {
        await User.findByIdAndUpdate(
          winnerId,
          { $inc: { 'statistics.totalWins': 1, 'statistics.tournamentsPlayed': 1 } },
          { session, new: true }
        );
      }
      
      // Incrémenter les défaites et tournois joués pour le perdant
      if (loserId) {
        await User.findByIdAndUpdate(
          loserId,
          { $inc: { 'statistics.totalLosses': 1, 'statistics.tournamentsPlayed': 1 } },
          { session, new: true }
        );
      }

      // Vérifier si c'est une demi-finale et si les deux demi-finales sont terminées
      const demiFinalRound = Math.ceil(Math.log2(tournament.players.length)) - 1;
      if (match.round === demiFinalRound) {
        // Récupérer toutes les demi-finales terminées
        const semiFinalMatches = await Match.find({
          tournamentId: tournament._id,
          round: demiFinalRound,
          status: 'completed'
        }).session(session);

        if (semiFinalMatches.length === 2) {
          // Récupérer les deux perdants
          const losers = semiFinalMatches.map(m => m.players.find(p => p.toString() !== m.winner.toString()));
          // Vérifier si la petite finale n'existe pas déjà
          const finalRound = demiFinalRound + 1;
          const existingThirdPlace = await Match.findOne({
            tournamentId: tournament._id,
            round: finalRound,
            matchNumber: 2
          }).session(session);

          if (!existingThirdPlace) {
            // Créer la petite finale
            const thirdPlaceMatch = new Match({
              tournamentId: tournament._id,
              round: finalRound,
              matchNumber: 2,
              players: losers,
              status: 'pending',
              date: new Date(tournament.date),
              time: getRandomTime(),
              bracketPosition: {
                x: finalRound,
                y: 2
              }
            });
            await thirdPlaceMatch.save({ session });
            console.log(`[BracketService] Petite finale créée entre ${losers[0]} et ${losers[1]}`);
          }
        }
      }

      // Vérifier si c'est la finale principale ou la petite finale
      const isMainFinal = match.round === Math.ceil(Math.log2(tournament.players.length));
      const isThirdPlaceMatch = match.matchNumber === 2 && match.round === Math.ceil(Math.log2(tournament.players.length));

      if (isMainFinal || isThirdPlaceMatch) {
        // Si c'est la finale principale ou la petite finale, vérifier si le tournoi est terminé
        const allMatches = await Match.find({ tournamentId: tournament._id }).session(session);
        const allMatchesCompleted = allMatches.every(m => m.status === 'completed');

        if (allMatchesCompleted) {
          isTournamentComplete = true;
          await Tournament.findByIdAndUpdate(
            tournament._id,
            { $set: { status: 'complete' } },
            { session }
          );

          // Distribuer les récompenses
          const rewardsToCreate = [];

          if (isMainFinal) {
            // Premier et deuxième place
            if (match.winner && tournament.firstPlaceReward > 0) {
              rewardsToCreate.push({
                userId: match.winner,
                tournamentId: tournament._id,
                type: 'win',
                amount: tournament.firstPlaceReward,
                description: `1ère Place - ${tournament.title}`,
                status: 'not_collected'
              });
            }

            const runnerUp = match.players.find(p => p.toString() !== match.winner.toString());
            if (runnerUp && tournament.secondPlaceReward > 0) {
              rewardsToCreate.push({
                userId: runnerUp,
                tournamentId: tournament._id,
                type: 'win',
                amount: tournament.secondPlaceReward,
                description: `2ème Place - ${tournament.title}`,
                status: 'not_collected'
              });
            }
          } else if (isThirdPlaceMatch && match.winner && tournament.thirdPlaceReward > 0) {
            // Troisième place
            rewardsToCreate.push({
              userId: match.winner,
              tournamentId: tournament._id,
              type: 'win',
              amount: tournament.thirdPlaceReward,
              description: `3ème Place - ${tournament.title}`,
              status: 'not_collected'
            });
          }

          if (rewardsToCreate.length > 0) {
            await Reward.insertMany(rewardsToCreate, { session });
          }
        }
      } else if (match.nextMatchId) {
        // Pour les autres matchs, avancer le gagnant au prochain match
        const nextMatch = await Match.findById(match.nextMatchId).session(session);
        if (nextMatch) {
          if (!nextMatch.players.includes(match.winner)) {
            nextMatch.players.push(match.winner);
          }
          if (nextMatch.players.length === 2) {
            nextMatch.status = 'pending';
          }
          await nextMatch.save({ session });
        }
      }
    });

    return { updatedMatch, isTournamentComplete };
  } catch (error) {
    console.error('Error in updateMatchResult:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Récupère l'arbre complet du tournoi
 * @param {string} tournamentId - ID du tournoi
 * @returns {Promise<Array>} - Tableau des matchs organisés
 */
async function getTournamentBracket(tournamentId) {
  try {
    console.log(`[Svc getTournamentBracket] Attempting to fetch matches for tournamentId: ${tournamentId}`);
    // Récupérer tous les matchs du tournoi avec les joueurs et les gagnants
    const matches = await Match.find({ tournamentId })
      .populate('players', '_id username avatar')
      .populate('winner', '_id username avatar')
      .sort({ round: 1, matchNumber: 1 });

    console.log(`[Svc getTournamentBracket] Found ${matches.length} matches for tournamentId: ${tournamentId}`);

    if (!matches || matches.length === 0) {
      console.log(`[Svc getTournamentBracket] No matches found for tournamentId: ${tournamentId}. Throwing error.`);
      throw new Error("Aucun match trouvé pour ce tournoi");
    }

    // Organiser les matchs par tour
    const bracketByRound = matches.reduce((acc, match) => {
      if (!acc[match.round]) {
        acc[match.round] = [];
      }
      acc[match.round].push({
        _id: match._id,
        round: match.round,
        matchNumber: match.matchNumber,
        players: match.players,
        winner: match.winner,
        status: match.status,
        nextMatchId: match.nextMatchId,
        bracketPosition: match.bracketPosition,
        date: match.date
      });
      return acc;
    }, {});

    // Vérifier que tous les tours sont présents
    const maxRound = Math.max(...matches.map(m => m.round));
    for (let i = 1; i <= maxRound; i++) {
      if (!bracketByRound[i]) {
        bracketByRound[i] = [];
      }
    }

    return matches;
  } catch (error) {
    console.error('Error in getTournamentBracket:', error);
    throw error;
  }
}

/**
 * Met à jour l'arbre du tournoi en fonction des scores existants
 * @param {string} tournamentId - ID du tournoi
 * @returns {Promise<void>}
 */
async function updateBracketFromExistingScores(tournamentId) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Récupérer tous les matchs du tournoi
      const matches = await Match.find({ tournamentId })
        .sort({ round: 1, matchNumber: 1 })
        .session(session);

      // Traiter d'abord les matchs du premier tour
      const firstRoundMatches = matches.filter(match => match.round === 1);
      
      for (const match of firstRoundMatches) {
        if (match.player1Score !== undefined && match.player2Score !== undefined) {
          // Si le match a des scores, déterminer le gagnant
          const winnerId = match.player1Score > match.player2Score ? 
            match.players[0] : match.players[1];
          
          // Mettre à jour le statut du match
          match.status = 'completed';
          match.winner = winnerId;
          await match.save({ session });

          // Faire progresser le gagnant au prochain match
          if (match.nextMatchId) {
            await advanceWinnerToNextMatch(match.nextMatchId, winnerId, session);
          }
        }
      }

      // Traiter les tours suivants dans l'ordre
      const maxRound = Math.max(...matches.map(m => m.round));
      for (let round = 2; round <= maxRound; round++) {
        const roundMatches = matches.filter(match => match.round === round);
        
        for (const match of roundMatches) {
          if (match.player1Score !== undefined && match.player2Score !== undefined) {
            const winnerId = match.player1Score > match.player2Score ? 
              match.players[0] : match.players[1];
            
            match.status = 'completed';
            match.winner = winnerId;
            await match.save({ session });

            if (match.nextMatchId) {
              await advanceWinnerToNextMatch(match.nextMatchId, winnerId, session);
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error updating bracket from existing scores:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Fait progresser un gagnant vers le prochain match
 * @param {string} nextMatchId - ID du prochain match
 * @param {string} winnerId - ID du gagnant
 * @param {ClientSession} session - Session MongoDB
 * @returns {Promise<void>}
 */
async function advanceWinnerToNextMatch(nextMatchId, winnerId, session) {
  const nextMatch = await Match.findById(nextMatchId).session(session);
  if (!nextMatch) return;

  // Ajouter le gagnant aux joueurs du prochain match s'il n'y est pas déjà
  if (!nextMatch.players.includes(winnerId)) {
    nextMatch.players.push(winnerId);
  }

  // Si le match a maintenant deux joueurs, le mettre en attente
  if (nextMatch.players.length === 2) {
    nextMatch.status = 'pending';
  }

  await nextMatch.save({ session });
}

module.exports = {
  generateFirstRoundMatches,
  generateNextRoundMatches,
  updateMatchResult,
  getTournamentBracket,
  updateBracketFromExistingScores
}; 