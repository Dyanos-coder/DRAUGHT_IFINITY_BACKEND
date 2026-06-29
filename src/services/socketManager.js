let _io = null;

module.exports = {
  init(io) {
    _io = io;
  },

  getIo() {
    return _io;
  },

  // Émet un event vers la chambre privée d'un joueur
  emitToPlayer(playerId, event, data) {
    if (_io) {
      _io.to(`player_${playerId}`).emit(event, data);
    }
  }
};
