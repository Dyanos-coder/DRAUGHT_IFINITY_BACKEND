const Tournament = require('../models/tournament.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const Reward = require('../models/reward.model');
const Match = require('../models/match.model');
const bracketService = require('../services/bracketService');
const mongoose = require('mongoose');

// Get all tournaments
exports.getAllTournaments = async (req, res) => {
  try {
    const { gameId } = req.query;
    
    // Construire la requête de filtrage
    let query = {};
    
    // Filtrer par jeu si gameId est fourni
    if (gameId) {
      query.game = gameId;
    }
    
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username email')
      .populate('game', 'name logo coverImage category status')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ tournaments });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get tournament by ID
exports.getTournamentById = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('players', 'username email')
      .populate('game', 'name logo coverImage category status');
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    res.status(200).json(tournament);
  } catch (error) {
    console.error("Erreur lors de la récupération du tournoi:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create a new tournament
exports.createTournament = async (req, res) => {
  try {
    console.log("Données reçues:", req.body);
    
    const currentDate = new Date();
    
    // Préparer les données du tournoi
    let tournamentData = {
      ...req.body,
      createdBy: req.userId || req.user._id, // Utiliser l'ID de l'utilisateur authentifié
      // Convertir les dates si elles sont présentes
      date: req.body.date ? new Date(req.body.date) : undefined,
      matchTime: req.body.matchTime // Ajout de l'heure des matchs
    };
    
    // Gérer la date de début d'inscription
    if (req.body.status === 'upcoming' && req.body.registrationStart) {
      // Si statut "à venir" et date de début d'inscription fournie, la convertir
      tournamentData.registrationStart = new Date(req.body.registrationStart);
    } else if (req.body.status === 'open') {
      // Si statut "ouvert aux inscriptions", utiliser la date actuelle comme date de début
      tournamentData.registrationStart = currentDate;
    }
    
    // Date limite d'inscription (si fournie)
    if (req.body.registrationDeadline) {
      tournamentData.registrationDeadline = new Date(req.body.registrationDeadline);
    }
    
    // Vérifier si la date de début d'inscription est atteinte ou dépassée
    if (tournamentData.registrationStart && tournamentData.registrationStart <= currentDate) {
      tournamentData.status = 'open'; // Mettre le statut à "ouvert aux inscriptions"
    }
    
    // Vérifier si la date du tournoi est atteinte ou dépassée
    if (tournamentData.date && tournamentData.date <= currentDate) {
      tournamentData.status = 'in-progress'; // Mettre le statut à "en cours"
    }
    
    // Créer un nouveau tournoi avec les données préparées
    const newTournament = new Tournament(tournamentData);

    console.log("Tournoi à créer:", newTournament);
    
    await newTournament.save();
    
    res.status(201).json({ 
      message: 'Tournoi créé avec succès', 
      tournament: newTournament 
    });
  } catch (error) {
    console.error("Erreur lors de la création du tournoi:", error);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la création du tournoi', 
      error: error.message 
    });
  }
};

// Update tournament
exports.updateTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    // Vérifier si le tournoi est en cours ou terminé
    if (tournament.status === 'in-progress' || tournament.status === 'complete') {
      return res.status(403).json({ 
        message: 'Les tournois en cours ou terminés ne peuvent pas être modifiés' 
      });
    }
    
    // Check if user is the creator of the tournament
    if (tournament.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this tournament' });
    }
    
    const currentDate = new Date();
    
    // Préparer les données de mise à jour
    let updateData = { ...req.body };
    
    // Convertir les dates
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }
    
    // Gérer la date de début d'inscription
    if (updateData.status === 'upcoming' && updateData.registrationStart) {
      // Si statut "à venir" et date de début d'inscription fournie, la convertir
      updateData.registrationStart = new Date(updateData.registrationStart);
    } else if (updateData.status === 'open') {
      // Si statut "ouvert aux inscriptions", utiliser la date actuelle comme date de début
      updateData.registrationStart = currentDate;
    }
    
    // Date limite d'inscription (si fournie)
    if (updateData.registrationDeadline) {
      updateData.registrationDeadline = new Date(updateData.registrationDeadline);
    }
    
    // Vérifier si la date de début d'inscription est atteinte ou dépassée
    if (updateData.registrationStart && updateData.registrationStart <= currentDate) {
      updateData.status = 'open'; // Mettre le statut à "ouvert aux inscriptions"
    }
    
    // Vérifier si la date du tournoi est atteinte ou dépassée
    if (updateData.date && updateData.date <= currentDate) {
      updateData.status = 'in-progress'; // Mettre le statut à "en cours"
    }
    
    const updatedTournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    res.status(200).json({ 
      message: 'Tournament updated successfully', 
      tournament: updatedTournament 
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du tournoi:", error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// Delete tournament
exports.deleteTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }
    
    // Check if user is the creator of the tournament
    if (tournament.createdBy.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this tournament' });
    }
    
    await Tournament.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Register user for tournament
exports.registerForTournament = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await Tournament.findById(req.params.id).session(session);
    const user = await User.findById(req.userId).session(session);
    
    if (!tournament) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (!user) {
       await session.abortTransaction();
       session.endSession();
       return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if tournament is full
    if (tournament.currentParticipants >= tournament.maxParticipants) {
       await session.abortTransaction();
       session.endSession();
      return res.status(400).json({ message: 'Tournament is full' });
    }
    
    // Check if user is already registered
    if (tournament.players.includes(req.userId)) {
       await session.abortTransaction();
       session.endSession();
      return res.status(400).json({ message: 'You are already registered for this tournament' });
    }
    
    // --- Logique d'inscription par tickets ---
    // Calculer le nombre de tickets requis (1 ticket = 1050 FCFA, basé sur entryFee)
    const ticketsRequired = Math.ceil(tournament.entryFee / 1050);

    if ((user.ticketsDeTournois || 0) < ticketsRequired) {
      // Optionnel: Enregistrer une transaction échouée si nécessaire
       await Transaction.create([{ // Utilisez create avec un tableau
        userId: user._id,
        amount: ticketsRequired,
        type: 'tournament_registration',
        description: `Tentative d'inscription échouée au tournoi ${tournament.title || '[Sans titre]'} - Tickets insuffisants (${ticketsRequired} tickets requis)`,
        currency: 'ticket',
        status: 'failed',
        relatedTournament: tournament._id,
        date: new Date()
      }], { session: session });

      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        message: `Solde de tickets insuffisant pour l'inscription. ${ticketsRequired} tickets requis (${tournament.entryFee} FCFA).` 
      });
    }

    // Débiter les tickets
    user.ticketsDeTournois = (user.ticketsDeTournois || 0) - ticketsRequired;

    // Ajouter l'utilisateur à la liste des joueurs du tournoi
    tournament.players.push(user._id);
    tournament.currentParticipants = (tournament.currentParticipants || 0) + 1;
    
    // Créer une transaction pour l'inscription
    await Transaction.create([{ // Utilisez create avec un tableau
      userId: user._id,
      amount: ticketsRequired,
      type: 'tournament_registration',
      description: `Inscription au tournoi ${tournament.title || '[Sans titre]'} (${ticketsRequired} tickets)`,
      currency: 'ticket',
      status: 'completed',
      relatedTournament: tournament._id,
      date: new Date()
    }], { session: session });

    // Créer une récompense de 20 points de fidélité
    const reward = new Reward({
      userId: user._id,
      tournamentId: tournament._id,
      type: 'participation',
      amount: 20,
      description: `Points de fidélité pour l'inscription au tournoi ${tournament.title}`,
      status: 'not_collected'
    });

    await reward.save({ session });

    // Sauvegarder les changements
    await user.save({ session });
    await tournament.save({ session });

    // Valider la transaction de la session
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ 
      message: 'Successfully registered for tournament', 
      tournament,
      reward: {
        points: 20,
        description: `Points de fidélité pour l'inscription au tournoi ${tournament.title}`,
        status: 'not_collected'
      },
      ticketsUsed: ticketsRequired
    });
  } catch (error) {
    // Annuler la transaction en cas d'erreur
    await session.abortTransaction();
    session.endSession();

    console.error("Erreur lors de l'inscription au tournoi:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 

/**
 * Récupérer les tournois auxquels un utilisateur est inscrit
 */
exports.getUserTournaments = async (req, res) => {
  try {
    const { gameId } = req.query;
    
    // Construire la requête de filtrage
    let query = { players: req.userId };
    
    // Filtrer par jeu si gameId est fourni
    if (gameId) {
      query.game = gameId;
    }
    
    // Trouver tous les tournois où l'utilisateur est dans le tableau des joueurs
    const tournaments = await Tournament.find(query)
      .populate('createdBy', 'username email')
      .populate('game', 'name logo coverImage category status')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ tournaments });
  } catch (error) {
    console.error("Erreur lors de la récupération des tournois de l'utilisateur:", error);
    res.status(500).json({ 
      message: 'Erreur serveur lors de la récupération des tournois', 
      error: error.message 
    });
  }
}; 

/**
 * Génère l'arbre de tournoi initial
 */
exports.generateBracket = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId)
      .populate('players', '_id username avatar');

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Vérifier si le tournoi a assez de joueurs
    if (!tournament.players || tournament.players.length < 2) {
      return res.status(400).json({ 
        message: 'Il faut au moins 2 joueurs pour générer un arbre de tournoi' 
      });
    }

    // Vérifier si des matchs existent déjà
    const existingMatches = await Match.find({ tournamentId });
    
    // Si des matchs existent, sauvegarder leurs scores avant de régénérer
    const matchScores = new Map();
    if (existingMatches.length > 0) {
      existingMatches.forEach(match => {
        if (match.player1Score !== undefined && match.player2Score !== undefined) {
          matchScores.set(match._id.toString(), {
            player1Score: match.player1Score,
            player2Score: match.player2Score,
            players: match.players
          });
        }
      });
      // Supprimer les matchs existants avant de régénérer
      await Match.deleteMany({ tournamentId });
    }

    // Générer les matchs du premier tour
    const playerIds = tournament.players.map(p => p._id);
    const firstRoundMatches = await bracketService.generateFirstRoundMatches(
      tournamentId,
      playerIds
    );

    // Si des scores existaient, les réappliquer aux nouveaux matchs
    if (matchScores.size > 0) {
      // Mettre à jour les scores des matchs
      for (const match of firstRoundMatches) {
        const oldMatchScore = matchScores.get(match._id.toString());
        if (oldMatchScore && 
            match.players.length === oldMatchScore.players.length &&
            match.players.every(p => oldMatchScore.players.includes(p))) {
          await Match.findByIdAndUpdate(match._id, {
            player1Score: oldMatchScore.player1Score,
            player2Score: oldMatchScore.player2Score
          });
        }
      }
      
      // Mettre à jour l'arbre en fonction des scores existants
      await bracketService.updateBracketFromExistingScores(tournamentId);
    }

    // Mettre à jour le statut du tournoi si nécessaire
    if (tournament.status !== 'in-progress') {
      tournament.status = 'in-progress';
      await tournament.save();
    }

    res.json({
      message: existingMatches.length > 0 ? 
        'Arbre du tournoi régénéré avec succès' : 
        'Arbre du tournoi généré avec succès',
      matches: firstRoundMatches
    });
  } catch (error) {
    console.error('Error generating bracket:', error);
    res.status(500).json({ 
      message: 'Error generating tournament bracket',
      error: error.message 
    });
  }
};

/**
 * Met à jour le résultat d'un match
 */
exports.updateMatchResult = async (req, res) => {
  try {
    const { matchId } = req.params;
    // Updated to include scores, date, and time from request body
    const { winnerId, player1Score, player2Score, date, time } = req.body;

    // Basic validation: winnerId or scores should be present
    if (!winnerId && (player1Score === undefined || player2Score === undefined)) {
      return res.status(400).json({ message: 'Winner ID or scores are required' });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // If winnerId is provided, validate it (optional if scores determine winner)
    if (winnerId && !match.players.map(p => p.toString()).includes(winnerId)) {
      return res.status(400).json({ 
        message: 'Winner must be one of the match players' 
      });
    }

    // Mettre à jour le match et vérifier si le tournoi est terminé
    // Pass all relevant data to the service layer
    const result = await bracketService.updateMatchResult(
      matchId,
      {
        winnerId, 
        player1Score, 
        player2Score, 
        date, 
        time
      }
    );

    res.json({
      message: 'Match result updated successfully',
      match: result.updatedMatch, // Send back the updated match
      isTournamentComplete: result.isTournamentComplete
    });
  } catch (error) {
    console.error('Error updating match result:', error);
    // Check for specific error messages from service if any
    if (error.message === 'Match not found' || error.message === 'Next match not found') {
      return res.status(404).json({ message: error.message, error: error.message });
    }
    res.status(500).json({ 
      message: 'Error updating match result',
      error: error.message 
    });
  }
};

/**
 * Récupère l'arbre du tournoi
 */
exports.getTournamentBracket = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    console.log(`[Ctrlr getTournamentBracket] Attempting to fetch bracket for tournamentId: ${tournamentId}`);

    if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
      console.log(`[Ctrlr getTournamentBracket] Invalid tournamentId format: ${tournamentId}`);
      return res.status(400).json({ 
        message: 'ID de tournoi invalide'
      });
    }

    const tournament = await Tournament.findById(tournamentId);
    console.log(`[Ctrlr getTournamentBracket] Fetched tournament: ${tournament?._id}, hasGeneratedBracket: ${tournament?.hasGeneratedBracket}`);

    if (!tournament) {
      console.log(`[Ctrlr getTournamentBracket] Tournament not found: ${tournamentId}`);
      return res.status(404).json({ 
        message: 'Tournoi introuvable'
      });
    }

    if (!tournament.hasGeneratedBracket) {
      console.log(`[Ctrlr getTournamentBracket] Bracket not generated according to tournament flag for ${tournamentId}.`);
      return res.status(404).json({ 
        message: "L'arbre du tournoi n'a pas encore été généré (selon le drapeau du tournoi)"
      });
    }

    console.log(`[Ctrlr getTournamentBracket] Calling bracketService.getTournamentBracket for ${tournamentId}`);
    const bracket = await bracketService.getTournamentBracket(tournamentId);
    
    if (!bracket || (Array.isArray(bracket) && bracket.length === 0)) {
      console.log(`[Ctrlr getTournamentBracket] bracketService returned empty or no matches for ${tournamentId}`);
      return res.status(404).json({ 
        message: "Aucun match trouvé pour ce tournoi, bien que l'arbre semble généré."
      });
    }
    
    res.json(bracket);
  } catch (error) {
    console.error('[Ctrlr getTournamentBracket] Error fetching tournament bracket:', error);
    if (error.message && error.message.toLowerCase().includes("aucun match trouvé pour ce tournoi")) {
        console.log(`[Ctrlr getTournamentBracket] Service explicitly reported no matches for ${req.params.tournamentId}`);
        return res.status(404).json({
            message: error.message,
        });
    }
    res.status(500).json({ 
      message: 'Erreur lors de la récupération de l\'arbre du tournoi',
      error: error.message 
    });
  }
}; 

/**
 * Met à jour manuellement l'arbre du tournoi
 */
exports.updateBracket = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = await Tournament.findById(tournamentId);

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Vérifier si l'arbre existe
    const existingMatches = await Match.find({ tournamentId });
    if (existingMatches.length === 0) {
      return res.status(400).json({ 
        message: 'Aucun arbre de tournoi n\'existe pour ce tournoi' 
      });
    }

    // Mettre à jour l'arbre en fonction des scores existants
    await bracketService.updateBracketFromExistingScores(tournamentId);

    res.json({
      message: 'Arbre du tournoi mis à jour avec succès',
      tournamentId
    });
  } catch (error) {
    console.error('Error updating tournament bracket:', error);
    res.status(500).json({ 
      message: 'Error updating tournament bracket',
      error: error.message 
    });
  }
}; 