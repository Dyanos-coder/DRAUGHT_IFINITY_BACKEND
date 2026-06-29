const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/config');

class RealtimeMatchmakingService {
  constructor(io) {
    this.io = io;
    this.waitingQueues = new Map();
    this.rooms = new Map();
  }

  attach() {
    this.io.on('connection', (socket) => {
      socket.data.authenticated = false;
      socket.data.roomId = null;
      socket.data.playerColor = null;
      socket.data.queueKey = null;
      socket.data.identity = null;

      socket.on('queue_join', (payload = {}, ack) => {
        try {
          const token = payload.token || socket.handshake.auth?.token;
          const gameId = payload.gameId || socket.handshake.auth?.gameId;
          const gameType = payload.gameType || socket.handshake.auth?.gameType || 'english';

          console.log(`🎮 queue_join reçu — socket: ${socket.id} | gameId: ${gameId} | gameType: ${gameType} | token: ${token ? '✓' : '✗ MANQUANT'}`);

          if (!token || !gameId) {
            console.warn(`⚠️ queue_join rejeté — token=${!!token} gameId=${!!gameId}`);
            return this._ack(ack, { ok: false, message: 'Token ou gameId manquant' });
          }

          const identity = this._verifyToken(token);
          if (!identity) {
            console.warn(`⚠️ queue_join rejeté — token invalide (socket ${socket.id})`);
            socket.disconnect(true);
            return this._ack(ack, { ok: false, message: 'Token invalide' });
          }

          socket.data.authenticated = true;
          socket.data.identity = identity;
          socket.data.gameId = gameId;
          socket.data.gameType = gameType;

          const queueKey = this._queueKey(gameId, gameType);
          socket.data.queueKey = queueKey;

          this._removeFromQueue(socket.id);
          const waitingPlayer = this._popWaitingPlayer(queueKey);

          console.log(`📋 File [${queueKey}] — joueur en attente: ${waitingPlayer ? waitingPlayer.id : 'aucun'}`);

          if (waitingPlayer) {
            const roomId = crypto.randomUUID();
            const whiteFirst = Math.random() >= 0.5;

            const room = {
              id: roomId,
              gameId,
              gameType,
              turnWhite: true,
              players: {
                white: whiteFirst ? waitingPlayer : socket,
                black: whiteFirst ? socket : waitingPlayer,
              },
            };

            this.rooms.set(roomId, room);
            waitingPlayer.join(roomId);
            socket.join(roomId);

            waitingPlayer.data.roomId = roomId;
            socket.data.roomId = roomId;
            waitingPlayer.data.playerColor = whiteFirst ? 'white' : 'black';
            socket.data.playerColor = whiteFirst ? 'black' : 'white';

            const matchPayloadForWaiting = {
              ok: true,
              roomId,
              yourColor: waitingPlayer.data.playerColor,
              opponentColor: socket.data.playerColor,
              gameId,
              gameType,
              whiteMovesDown: true,
            };
            const matchPayloadForJoining = {
              ok: true,
              roomId,
              yourColor: socket.data.playerColor,
              opponentColor: waitingPlayer.data.playerColor,
              gameId,
              gameType,
              whiteMovesDown: true,
            };

            console.log(`✅ Match trouvé — room: ${roomId} | blanc: ${room.players.white.id} | noir: ${room.players.black.id}`);
            waitingPlayer.emit('match_found', matchPayloadForWaiting);
            socket.emit('match_found', matchPayloadForJoining);
            this._ack(ack, { ok: true, matched: true, roomId });
            return;
          }

          this._enqueuePlayer(queueKey, socket);
          console.log(`⏳ Joueur ${socket.id} ajouté à la file [${queueKey}]`);
          socket.emit('queue_status', {
            ok: true,
            status: 'waiting',
            message: 'Recherche d\'un adversaire en cours...',
          });
          this._ack(ack, { ok: true, matched: false, status: 'waiting' });
        } catch (error) {
          this._ack(ack, { ok: false, message: error.message });
        }
      });

      socket.on('queue_leave', () => {
        this._removeFromQueue(socket.id);
        this._leaveRoom(socket);
      });

      socket.on('make_move', (payload = {}, ack) => {
        const roomId = payload.roomId || socket.data.roomId;
        const room = roomId ? this.rooms.get(roomId) : null;

        if (!room) {
          return this._ack(ack, { ok: false, message: 'Salle introuvable' });
        }

        const playerColor = socket.data.playerColor;
        if (!playerColor) {
          return this._ack(ack, { ok: false, message: 'Joueur non assigné' });
        }

        const isWhiteTurn = room.turnWhite;
        const isPlayerWhite = playerColor === 'white';
        if (isWhiteTurn !== isPlayerWhite) {
          return this._ack(ack, { ok: false, message: 'Ce n\'est pas votre tour' });
        }

        room.turnWhite = !room.turnWhite;

        socket.to(roomId).emit('opponent_move', {
          roomId,
          move: payload.move || payload,
          turnWhite: room.turnWhite,
        });

        this._ack(ack, { ok: true, turnWhite: room.turnWhite });
      });

      socket.on('resign', (payload = {}) => {
        const roomId = payload.roomId || socket.data.roomId;
        if (!roomId || !this.rooms.has(roomId)) return;
        socket.to(roomId).emit('opponent_resigned', {
          roomId,
          reason: 'resign',
        });
        this._cleanupRoom(roomId);
      });

      socket.on('disconnect', () => {
        this._removeFromQueue(socket.id);
        const roomId = socket.data.roomId;
        if (roomId && this.rooms.has(roomId)) {
          socket.to(roomId).emit('opponent_left', { roomId });
          this._cleanupRoom(roomId);
        }
      });
    });
  }

  _ack(ack, payload) {
    if (typeof ack === 'function') ack(payload);
  }

  _verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (_) {
      return null;
    }
  }

  _queueKey(gameId, gameType) {
    return `${gameId}:${gameType}`;
  }

  _enqueuePlayer(queueKey, socket) {
    const queue = this.waitingQueues.get(queueKey) || [];
    queue.push(socket);
    this.waitingQueues.set(queueKey, queue);
  }

  _popWaitingPlayer(queueKey) {
    const queue = this.waitingQueues.get(queueKey) || [];
    const player = queue.shift() || null;
    this.waitingQueues.set(queueKey, queue);
    return player;
  }

  _removeFromQueue(socketId) {
    for (const [queueKey, queue] of this.waitingQueues.entries()) {
      const filtered = queue.filter((socket) => socket.id !== socketId);
      if (filtered.length !== queue.length) {
        this.waitingQueues.set(queueKey, filtered);
      }
    }
  }

  _leaveRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.leave(roomId);
    socket.data.roomId = null;
    socket.data.playerColor = null;
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
    }
  }

  _cleanupRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players.white?.leave(roomId);
    room.players.black?.leave(roomId);
    if (room.players.white) {
      room.players.white.data.roomId = null;
      room.players.white.data.playerColor = null;
    }
    if (room.players.black) {
      room.players.black.data.roomId = null;
      room.players.black.data.playerColor = null;
    }
    this.rooms.delete(roomId);
  }
}

module.exports = RealtimeMatchmakingService;
