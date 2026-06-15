const Dispute = require('../models/dispute.model');
const Match = require('../models/match.model');
const Tournament = require('../models/tournament.model');
const Reward = require('../models/reward.model');
const mongoose = require('mongoose');

/**
 * Create a new dispute
 */
exports.createDispute = async (req, res) => {
  try {
    const {
      matchId,
      opponentId,
      reason,
      description,
      proofUrl,
      category,
      playerScore,
      opponentScore
    } = req.body;

    const dispute = new Dispute({
      userId: req.userId,
      matchId,
      opponentId,
      reason,
      description,
      proofUrl,
      category,
      playerScore: category === 'match_result' ? playerScore : undefined,
      opponentScore: category === 'match_result' ? opponentScore : undefined,
      status: 'pending'
    });

    await dispute.save();

    res.status(201).json({
      message: 'Dispute created successfully',
      dispute
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({
      message: 'Error creating dispute',
      error: error.message
    });
  }
};

/**
 * Get all disputes (admin only)
 */
exports.getAllDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('userId', 'username avatar')
      .populate('opponentId', 'username avatar')
      .populate({
        path: 'matchId',
        populate: {
          path: 'tournamentId',
          select: 'title'
        }
      })
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 });

    // Format the disputes for frontend display
    const formattedDisputes = disputes.map(dispute => {
      // Vérifier si les champs requis existent
      if (!dispute.userId || !dispute.opponentId || !dispute.matchId) {
        console.error('Dispute with missing required fields:', dispute._id);
        return null;
      }

      return {
        _id: dispute._id,
        user: {
          _id: dispute.userId._id,
          username: dispute.userId.username || 'Utilisateur supprimé',
          avatar: dispute.userId.avatar
        },
        opponent: {
          _id: dispute.opponentId._id,
          username: dispute.opponentId.username || 'Utilisateur supprimé',
          avatar: dispute.opponentId.avatar
        },
        match: {
          _id: dispute.matchId._id,
          tournament: dispute.matchId.tournamentId ? {
            _id: dispute.matchId.tournamentId._id,
            title: dispute.matchId.tournamentId.title
          } : null,
          date: dispute.matchId.date || new Date(),
          time: dispute.matchId.time,
          status: dispute.matchId.status || 'unknown'
        },
        reason: dispute.reason,
        category: dispute.category,
        description: dispute.description,
        proofUrl: dispute.proofUrl,
        playerScore: dispute.playerScore,
        opponentScore: dispute.opponentScore,
        status: dispute.status || 'pending',
        adminComment: dispute.adminComment,
        resolvedAt: dispute.resolvedAt,
        resolvedBy: dispute.resolvedBy ? {
          _id: dispute.resolvedBy._id,
          username: dispute.resolvedBy.username
        } : null,
        createdAt: dispute.createdAt || new Date()
      };
    }).filter(dispute => dispute !== null); // Filtrer les litiges invalides

    res.status(200).json(formattedDisputes);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({
      message: 'Error fetching disputes',
      error: error.message
    });
  }
};

/**
 * Get user's disputes
 */
exports.getUserDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find({ userId: req.userId })
      .populate('opponentId', 'username')
      .populate({
        path: 'matchId',
        populate: {
          path: 'tournamentId',
          select: 'title'
        }
      })
      .sort({ createdAt: -1 });

    const formattedDisputes = disputes
      .filter(dispute => dispute && dispute.matchId && dispute.opponentId)
      .map(dispute => ({
      _id: dispute._id,
      match: {
        _id: dispute.matchId._id,
        tournament: dispute.matchId.tournamentId ? {
          title: dispute.matchId.tournamentId.title
        } : undefined
      },
      opponent: {
        username: dispute.opponentId.username
      },
      category: dispute.category,
      reason: dispute.reason,
      status: dispute.status,
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
      adminComment: dispute.adminComment
    }));

    res.status(200).json(formattedDisputes);
  } catch (error) {
    console.error('Error fetching user disputes:', error);
    res.status(500).json({
      message: 'Error fetching user disputes',
      error: error.message
    });
  }
};

/**
 * Get a specific dispute
 */
exports.getDisputeById = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('userId', 'username')
      .populate('opponentId', 'username')
      .populate('matchId');

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Check if user is authorized to view this dispute
    if (dispute.userId._id.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this dispute' });
    }

    res.status(200).json(dispute);
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({
      message: 'Error fetching dispute',
      error: error.message
    });
  }
};

/**
 * Update dispute status (admin only)
 */
exports.updateDisputeStatus = async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    const dispute = await Dispute.findById(req.params.id);

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Update dispute status
    dispute.status = status;
    dispute.adminComment = adminComment;
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = req.userId;

    // If the dispute is approved and it's a match result dispute
    if (status === 'approved' && dispute.category === 'match_result') {
      const match = await Match.findById(dispute.matchId);
      
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      // Correction : attribuer les scores selon l'ordre des joueurs dans le match
      if (String(match.players[0]) === String(dispute.userId)) {
        match.player1Score = dispute.playerScore;
        match.player2Score = dispute.opponentScore;
      } else {
        match.player1Score = dispute.opponentScore;
        match.player2Score = dispute.playerScore;
      }
      match.status = 'completed';
      match.winner = match.player1Score > match.player2Score ? match.players[0] : match.players[1];
      
      // Save match updates
      await match.save();

      // If this match is part of a tournament, update the tournament bracket
      if (match.tournamentId) {
        const bracketService = require('../services/bracketService');
        await bracketService.updateMatchResult(match._id, {
          winnerId: match.winner,
          player1Score: match.player1Score,
          player2Score: match.player2Score
        });
      }
    }

    await dispute.save();

    res.status(200).json({
      message: 'Dispute status updated successfully',
      dispute
    });
  } catch (error) {
    console.error('Error updating dispute status:', error);
    res.status(500).json({
      message: 'Error updating dispute status',
      error: error.message
    });
  }
};

/**
 * Get disputes for validator
 */
exports.getValidatorDisputes = async (req, res) => {
  try {
    // Récupérer tous les litiges en attente sauf ceux créés par le validateur connecté
    const disputes = await Dispute.find({
      status: 'pending',
      category: 'complaint',
      $nor: [
        { userId: req.userId },      // Exclure les litiges créés par le validateur
        { opponentId: req.userId }   // Exclure les litiges où le validateur est l'adversaire
      ]
    })
    .populate('userId', 'username avatar')
    .populate('opponentId', 'username avatar')
    .populate({
      path: 'matchId',
      populate: {
        path: 'tournamentId',
        select: 'title'
      }
    })
    .sort({ createdAt: -1 });

    const formattedDisputes = disputes.map(dispute => ({
      _id: dispute._id,
      match: {
        _id: dispute.matchId._id,
        tournament: dispute.matchId.tournamentId ? {
          title: dispute.matchId.tournamentId.title
        } : undefined
      },
      user: {
        _id: dispute.userId._id,
        username: dispute.userId.username,
        avatar: dispute.userId.avatar
      },
      opponent: {
        _id: dispute.opponentId._id,
        username: dispute.opponentId.username,
        avatar: dispute.opponentId.avatar
      },
      reason: dispute.reason,
      category: dispute.category,
      description: dispute.description,
      proofUrl: dispute.proofUrl,
      status: dispute.status,
      createdAt: dispute.createdAt
    }));

    res.status(200).json(formattedDisputes);
  } catch (error) {
    console.error('Error fetching validator disputes:', error);
    res.status(500).json({
      message: 'Error fetching validator disputes',
      error: error.message
    });
  }
};

/**
 * Update dispute by validator
 */
exports.updateDisputeByValidator = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { status, comment } = req.body;
      const dispute = await Dispute.findById(req.params.id).session(session);

      if (!dispute) {
        throw new Error('Dispute not found');
      }

      // Vérifier que le validateur n'est pas impliqué dans le litige
      if (dispute.userId.toString() === req.userId) {
        throw new Error('You cannot validate your own dispute');
      }

      // Ajouter la décision du validateur
      dispute.validators.push({
        userId: req.userId,
        decision: status,
        comment: comment
      });

      // Si c'est le premier validateur, mettre à jour le statut
      if (dispute.validators.length === 1) {
        dispute.status = status === 'approve' ? 'approved' : 'rejected';
        dispute.resolvedAt = new Date();
        dispute.resolvedBy = req.userId;
        dispute.adminComment = comment;

        // Créer une récompense pour le validateur
        const reward = new Reward({
          userId: req.userId,
          type: 'validation',
          amount: 25, // 25 FCFA par validation
          description: `Récompense pour la validation du litige #${dispute._id.toString().slice(-6)}`,
          status: 'not_collected'
        });

        await reward.save({ session });
      }

      await dispute.save({ session });

      res.status(200).json({
        message: 'Dispute updated successfully',
        dispute
      });
    });
  } catch (error) {
    console.error('Error updating dispute:', error);
    res.status(500).json({
      message: 'Error updating dispute',
      error: error.message
    });
  } finally {
    session.endSession();
  }
}; 
