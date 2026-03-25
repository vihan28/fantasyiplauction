const {
  placeBid,
  passPlayer,
  getLeagueSnapshot,
  concludeAuctionPlayerByTimer,
  getAuctionRuntimeState
} = require("../services/league-service");

function createAuctionRuntime(io) {
  const timers = new Map();

  function clearTimer(leagueCode) {
    const key = String(leagueCode).toUpperCase();
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
  }

  function broadcast(leagueCode) {
    const key = String(leagueCode).toUpperCase();
    io.to(`league:${key}`).emit("league:update", getLeagueSnapshot(key));
  }

  function sync(leagueCode) {
    const key = String(leagueCode).toUpperCase();
    clearTimer(key);

    const state = getAuctionRuntimeState(key);
    if (!state || state.status !== "live" || !state.expiresAt || !state.currentPlayerId) {
      return;
    }

    const delay = Math.max(new Date(state.expiresAt).getTime() - Date.now(), 0);
    const timer = setTimeout(() => {
      concludeAuctionPlayerByTimer({ leagueCode: key });
      sync(key);
      broadcast(key);
    }, delay);

    timers.set(key, timer);
  }

  function broadcastAll() {
    io.sockets.adapter.rooms.forEach((_, room) => {
      if (room.startsWith("league:")) {
        broadcast(room.replace("league:", ""));
      }
    });
  }

  io.on("connection", (socket) => {
    socket.on("league:join", ({ leagueCode, memberId }) => {
      const key = String(leagueCode || "").toUpperCase();
      if (!key) return;

      socket.join(`league:${key}`);
      if (memberId) {
        socket.join(`member:${memberId}`);
        socket.emit("league:personal", getLeagueSnapshot(key, memberId));
      } else {
        socket.emit("league:update", getLeagueSnapshot(key));
      }
    });

    socket.on("auction:bid", ({ leagueCode, memberId, amount }, callback = () => {}) => {
      try {
        placeBid({ leagueCode, memberId, amount });
        sync(leagueCode);
        broadcast(leagueCode);
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });

    socket.on("auction:pass", ({ leagueCode, memberId }, callback = () => {}) => {
      try {
        passPlayer({ leagueCode, memberId });
        sync(leagueCode);
        io.to(`member:${memberId}`).emit("auction:pass-confirmed", { ok: true });
        broadcast(leagueCode);
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, message: error.message });
      }
    });
  });

  return {
    sync,
    broadcast,
    broadcastAll
  };
}

module.exports = {
  createAuctionRuntime
};
