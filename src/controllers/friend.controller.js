const mongoose = require('mongoose');
const User = require('../models/user.model');
const gameDatabaseService = require('../services/gameDatabaseService');
const socketManager = require('../services/socketManager');

// ── Helpers ────────────────────────────────────────────────────────────────────

// Contexte jeu : disponible quand la requête vient d'un token Player
const gameCtx = (req) =>
  req.user && req.user.gameId && req.user.playerId
    ? { gameId: req.user.gameId.toString(), playerId: req.user.playerId.toString() }
    : null;

// Contexte site : User._id de la BD principale
const getUserId = (req) => req.linkedUserId || req.userId;

// Modèle Player depuis la connexion au jeu (lance une erreur si indisponible)
function getPlayerModel(gameId) {
  const conn = gameDatabaseService.getGameConnection(gameId);
  if (!conn) throw new Error('Connexion à la BD du jeu indisponible');
  return conn.model('Player');
}

// Formate un Player pour la réponse API
function fmtPlayer(p, currentPlayerId, friendIds, sentIds, receivedIds) {
  const id = p._id.toString();
  let status = 'none';
  if (id === currentPlayerId)     status = 'self';
  else if (friendIds.has(id))     status = 'friend';
  else if (sentIds.has(id))       status = 'request_sent';
  else if (receivedIds.has(id))   status = 'request_received';
  return {
    _id: p._id,
    username: p.inGameUsername,
    avatar: p.avatar || '',
    statistics: { totalWins: p.wins || 0, totalLosses: p.losses || 0, draws: p.draws || 0 },
    status
  };
}

// Formate un User (contexte site)
const SITE_FIELDS = 'username avatar statistics.totalWins statistics.totalLosses';
function fmtUser(u) {
  return { _id: u._id, username: u.username, avatar: u.avatar || '', statistics: u.statistics };
}

// ── Rechercher des joueurs/utilisateurs ────────────────────────────────────────
// GET /api/friends/search?query=...
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const ctx = gameCtx(req);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'La recherche doit contenir au moins 2 caractères' });
    }

    // ── Contexte jeu : tout dans la BD du jeu ─────────────────────────────────
    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);

      const currentPlayer = await Player.findById(ctx.playerId)
        .select('friends friendRequests');
      if (!currentPlayer) return res.status(404).json({ message: 'Joueur non trouvé' });

      const friendIds   = new Set((currentPlayer.friends || []).map(id => id.toString()));
      const sentIds     = new Set((currentPlayer.friendRequests?.sent || []).map(id => id.toString()));
      const receivedIds = new Set((currentPlayer.friendRequests?.received || []).map(id => id.toString()));

      const players = await Player.find({
        inGameUsername: { $regex: query.trim(), $options: 'i' }
      }).select('inGameUsername avatar wins losses draws').limit(20);

      const formatted = players.map(p =>
        fmtPlayer(p, ctx.playerId, friendIds, sentIds, receivedIds)
      );
      return res.status(200).json({ results: formatted });
    }

    // ── Contexte site : BD principale ─────────────────────────────────────────
    const userId = getUserId(req);
    const currentUser = await User.findById(userId).select('friends friendRequests');
    if (!currentUser) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const friendIds   = new Set((currentUser.friends || []).map(id => id.toString()));
    const sentIds     = new Set((currentUser.friendRequests?.sent || []).map(id => id.toString()));
    const receivedIds = new Set((currentUser.friendRequests?.received || []).map(id => id.toString()));

    const results = await User.find({
      _id: { $ne: userId },
      username: { $regex: query.trim(), $options: 'i' }
    }).select(SITE_FIELDS).limit(20);

    const formatted = results.map(u => {
      const id = u._id.toString();
      let status = 'none';
      if (friendIds.has(id))        status = 'friend';
      else if (sentIds.has(id))     status = 'request_sent';
      else if (receivedIds.has(id)) status = 'request_received';
      return { ...fmtUser(u), status };
    });
    res.status(200).json({ results: formatted });
  } catch (error) {
    console.error('❌ Erreur recherche:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Liste des amis ─────────────────────────────────────────────────────────────
// GET /api/friends
exports.getFriends = async (req, res) => {
  try {
    const ctx = gameCtx(req);

    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);
      const player = await Player.findById(ctx.playerId)
        .populate('friends', 'inGameUsername avatar wins losses draws');
      if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });

      const friends = (player.friends || []).map(f => ({
        _id: f._id,
        username: f.inGameUsername,
        avatar: f.avatar || '',
        statistics: { totalWins: f.wins || 0, totalLosses: f.losses || 0 },
        status: 'friend'
      }));
      return res.status(200).json({ friends });
    }

    const userId = getUserId(req);
    const user = await User.findById(userId).populate('friends', SITE_FIELDS);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.status(200).json({ friends: (user.friends || []).map(fmtUser) });
  } catch (error) {
    console.error('❌ Erreur récupération amis:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Demandes d'amis ────────────────────────────────────────────────────────────
// GET /api/friends/requests
exports.getFriendRequests = async (req, res) => {
  try {
    const ctx = gameCtx(req);

    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);
      const player = await Player.findById(ctx.playerId)
        .populate('friendRequests.sent',     'inGameUsername avatar')
        .populate('friendRequests.received', 'inGameUsername avatar');
      if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });

      const toBasic = p => ({
        _id: p._id, username: p.inGameUsername, avatar: p.avatar || '', statistics: {}
      });
      return res.status(200).json({
        sent:     (player.friendRequests?.sent     || []).map(toBasic),
        received: (player.friendRequests?.received || []).map(toBasic)
      });
    }

    const userId = getUserId(req);
    const user = await User.findById(userId)
      .populate('friendRequests.sent',     SITE_FIELDS)
      .populate('friendRequests.received', SITE_FIELDS);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.status(200).json({
      sent:     (user.friendRequests?.sent     || []).map(fmtUser),
      received: (user.friendRequests?.received || []).map(fmtUser)
    });
  } catch (error) {
    console.error('❌ Erreur récupération demandes:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Envoyer une demande d'ami ──────────────────────────────────────────────────
// POST /api/friends/requests/:userId
exports.sendFriendRequest = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    const targetId = req.params.userId;

    if (ctx) {
      if (targetId === ctx.playerId) {
        return res.status(400).json({ message: 'Vous ne pouvez pas vous ajouter vous-même' });
      }
      const Player = getPlayerModel(ctx.gameId);
      const [player, target] = await Promise.all([
        Player.findById(ctx.playerId),
        Player.findById(targetId)
      ]);
      if (!player || !target) return res.status(404).json({ message: 'Joueur non trouvé' });

      if (player.friends.some(id => id.toString() === targetId)) {
        return res.status(400).json({ message: 'Vous êtes déjà amis' });
      }
      if (player.friendRequests.sent.some(id => id.toString() === targetId)) {
        return res.status(400).json({ message: 'Demande déjà envoyée' });
      }
      // L'autre a déjà envoyé → accepter directement
      if (player.friendRequests.received.some(id => id.toString() === targetId)) {
        player.friendRequests.received.pull(targetId);
        target.friendRequests.sent.pull(ctx.playerId);
        player.friends.push(targetId);
        target.friends.push(ctx.playerId);
        await Promise.all([player.save(), target.save()]);
        return res.status(200).json({ message: 'Demande acceptée, vous êtes maintenant amis', status: 'friend' });
      }
      player.friendRequests.sent.push(targetId);
      target.friendRequests.received.push(ctx.playerId);

      // Créer la notification dans la BD du joueur cible
      target.notifications.push({
        type:         'friend_request',
        fromPlayerId: player._id,
        fromUsername: player.inGameUsername,
        fromAvatar:   player.avatar || '',
        message:      `${player.inGameUsername} veut vous ajouter en ami`,
        read:         false
      });

      await Promise.all([player.save(), target.save()]);

      // Émettre l'event Socket.io en temps réel si la cible est connectée
      socketManager.emitToPlayer(targetId, 'friend_request', {
        fromPlayerId: ctx.playerId,
        fromUsername: player.inGameUsername,
        fromAvatar:   player.avatar || '',
        message:      `${player.inGameUsername} veut vous ajouter en ami`
      });

      return res.status(200).json({ message: 'Demande d\'ami envoyée', status: 'request_sent' });
    }

    // Site context
    const userId = getUserId(req);
    if (!userId) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (targetId === userId.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous ajouter vous-même' });
    }
    const [user, target] = await Promise.all([User.findById(userId), User.findById(targetId)]);
    if (!user || !target) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    if (user.friends.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: 'Vous êtes déjà amis' });
    }
    if (user.friendRequests.sent.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: 'Demande déjà envoyée' });
    }
    if (user.friendRequests.received.some(id => id.toString() === targetId)) {
      user.friendRequests.received.pull(targetId);
      target.friendRequests.sent.pull(userId);
      user.friends.push(targetId);
      target.friends.push(userId);
      await Promise.all([user.save(), target.save()]);
      return res.status(200).json({ message: 'Demande acceptée, vous êtes maintenant amis', status: 'friend' });
    }
    user.friendRequests.sent.push(targetId);
    target.friendRequests.received.push(userId);
    await Promise.all([user.save(), target.save()]);
    res.status(200).json({ message: 'Demande d\'ami envoyée', status: 'request_sent' });
  } catch (error) {
    console.error('❌ Erreur envoi demande:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Accepter une demande d'ami ─────────────────────────────────────────────────
// POST /api/friends/requests/:userId/accept
exports.acceptFriendRequest = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    const requesterId = req.params.userId;

    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);
      const [player, requester] = await Promise.all([
        Player.findById(ctx.playerId),
        Player.findById(requesterId)
      ]);
      if (!player || !requester) return res.status(404).json({ message: 'Joueur non trouvé' });

      if (!player.friendRequests.received.some(id => id.toString() === requesterId)) {
        return res.status(400).json({ message: 'Aucune demande de ce joueur' });
      }
      player.friendRequests.received.pull(requesterId);
      requester.friendRequests.sent.pull(ctx.playerId);
      if (!player.friends.some(id => id.toString() === requesterId)) player.friends.push(requesterId);
      if (!requester.friends.some(id => id.toString() === ctx.playerId)) requester.friends.push(ctx.playerId);
      await Promise.all([player.save(), requester.save()]);
      return res.status(200).json({ message: 'Demande acceptée' });
    }

    const userId = getUserId(req);
    const [user, requester] = await Promise.all([User.findById(userId), User.findById(requesterId)]);
    if (!user || !requester) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (!user.friendRequests.received.some(id => id.toString() === requesterId)) {
      return res.status(400).json({ message: 'Aucune demande de cet utilisateur' });
    }
    user.friendRequests.received.pull(requesterId);
    requester.friendRequests.sent.pull(userId);
    if (!user.friends.some(id => id.toString() === requesterId)) user.friends.push(requesterId);
    if (!requester.friends.some(id => id.toString() === userId.toString())) requester.friends.push(userId);
    await Promise.all([user.save(), requester.save()]);
    res.status(200).json({ message: 'Demande acceptée' });
  } catch (error) {
    console.error('❌ Erreur acceptation demande:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Refuser/annuler une demande d'ami ─────────────────────────────────────────
// POST /api/friends/requests/:userId/decline
exports.declineFriendRequest = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    const otherId = req.params.userId;

    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);
      const player = await Player.findById(ctx.playerId);
      if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });
      player.friendRequests.received.pull(otherId);
      player.friendRequests.sent.pull(otherId);
      await player.save();
      const other = await Player.findById(otherId);
      if (other) {
        other.friendRequests.sent.pull(ctx.playerId);
        other.friendRequests.received.pull(ctx.playerId);
        await other.save();
      }
      return res.status(200).json({ message: 'Demande refusée' });
    }

    const userId = getUserId(req);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    user.friendRequests.received.pull(otherId);
    user.friendRequests.sent.pull(otherId);
    await user.save();
    const other = await User.findById(otherId);
    if (other) {
      other.friendRequests.sent.pull(userId);
      other.friendRequests.received.pull(userId);
      await other.save();
    }
    res.status(200).json({ message: 'Demande refusée' });
  } catch (error) {
    console.error('❌ Erreur refus demande:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Retirer un ami ─────────────────────────────────────────────────────────────
// DELETE /api/friends/:userId
exports.removeFriend = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    const friendId = req.params.userId;

    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);
      const player = await Player.findById(ctx.playerId);
      if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });
      player.friends.pull(friendId);
      await player.save();
      const friend = await Player.findById(friendId);
      if (friend) { friend.friends.pull(ctx.playerId); await friend.save(); }
      return res.status(200).json({ message: 'Ami retiré' });
    }

    const userId = getUserId(req);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    user.friends.pull(friendId);
    await user.save();
    const friend = await User.findById(friendId);
    if (friend) { friend.friends.pull(userId); await friend.save(); }
    res.status(200).json({ message: 'Ami retiré' });
  } catch (error) {
    console.error('❌ Erreur suppression ami:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Notifications ──────────────────────────────────────────────────────────────
// GET /api/friends/notifications
exports.getNotifications = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    if (!ctx) return res.status(400).json({ message: 'Contexte jeu requis' });

    const Player = getPlayerModel(ctx.gameId);
    const player = await Player.findById(ctx.playerId).select('notifications');
    if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });

    // Trier par date décroissante, limiter à 50
    const notifications = [...(player.notifications || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    const unreadCount = notifications.filter(n => !n.read).length;

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('❌ Erreur récupération notifications:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// PUT /api/friends/notifications/read-all
exports.markNotificationsRead = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    if (!ctx) return res.status(400).json({ message: 'Contexte jeu requis' });

    const Player = getPlayerModel(ctx.gameId);
    const player = await Player.findById(ctx.playerId).select('notifications');
    if (!player) return res.status(404).json({ message: 'Joueur non trouvé' });

    (player.notifications || []).forEach(n => { n.read = true; });
    await player.save();

    res.status(200).json({ message: 'Notifications marquées comme lues' });
  } catch (error) {
    console.error('❌ Erreur mark notifications:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// ── Profil public ──────────────────────────────────────────────────────────────
// GET /api/friends/profile/:userId
exports.getPublicProfile = async (req, res) => {
  try {
    const ctx = gameCtx(req);
    const targetId = req.params.userId;

    // ── Contexte jeu : profil depuis la BD du jeu ──────────────────────────────
    if (ctx) {
      const Player = getPlayerModel(ctx.gameId);

      // targetId peut être un Player._id direct ou un User._id (cas jean avec userId)
      let player = null;
      try { player = await Player.findById(targetId); } catch (_) {}
      if (!player) {
        try { player = await Player.findOne({ userId: new mongoose.Types.ObjectId(targetId) }); } catch (_) {}
      }
      if (!player) return res.status(404).json({ message: 'Joueur non trouvé dans ce jeu' });

      // Statut ami : basé sur les friends/friendRequests du Player courant
      let status = 'none';
      const targetIdStr = player._id.toString();
      if (targetIdStr === ctx.playerId) {
        status = 'self';
      } else {
        const currentPlayer = await Player.findById(ctx.playerId).select('friends friendRequests');
        if (currentPlayer) {
          const fids = (currentPlayer.friends || []).map(id => id.toString());
          const sids = (currentPlayer.friendRequests?.sent || []).map(id => id.toString());
          const rids = (currentPlayer.friendRequests?.received || []).map(id => id.toString());
          if (fids.includes(targetIdStr))       status = 'friend';
          else if (sids.includes(targetIdStr))  status = 'request_sent';
          else if (rids.includes(targetIdStr))  status = 'request_received';
        }
      }

      return res.status(200).json({
        user: {
          _id: player._id,
          username: player.inGameUsername,
          avatar: player.avatar || '',
          statistics: { totalWins: player.wins || 0, totalLosses: player.losses || 0, draws: player.draws || 0 },
          level: player.level || 1,
          experience: player.experience || 0,
          checkersProgress: player.checkersProgress || {},
          soldePiece: player.soldePiece || 0,
          soldeEnergie: player.soldeEnergie || 0,
          memberSince: player.registeredAt || player.createdAt,
          lastActive: player.lastActive
        },
        status
      });
    }

    // ── Contexte site ──────────────────────────────────────────────────────────
    const userId = getUserId(req);
    const target = await User.findById(targetId)
      .select('username avatar statistics profile createdAt');
    if (!target) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    let status = 'none';
    if (userId && userId.toString() === targetId) {
      status = 'self';
    } else if (userId) {
      const currentUser = await User.findById(userId).select('friends friendRequests');
      if (currentUser) {
        if (currentUser.friends.some(id => id.toString() === targetId))                     status = 'friend';
        else if (currentUser.friendRequests.sent.some(id => id.toString() === targetId))     status = 'request_sent';
        else if (currentUser.friendRequests.received.some(id => id.toString() === targetId)) status = 'request_received';
      }
    }
    res.status(200).json({
      user: {
        _id: target._id,
        username: target.username,
        avatar: target.avatar,
        statistics: target.statistics,
        memberSince: target.profile?.createdAt || target.createdAt
      },
      status
    });
  } catch (error) {
    console.error('❌ Erreur profil public:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};
