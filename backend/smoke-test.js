const { spawn } = require("child_process");
const path = require("path");
const { io } = require("socket.io-client");

const baseUrl = "http://127.0.0.1:5000";

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || `Request failed: ${pathname}`);
  }

  return payload;
}

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => {
      if (!result || result.ok === false) {
        reject(new Error(result?.message || `${event} failed`));
        return;
      }
      resolve(result);
    });
  });
}

async function main() {
  const server = spawn("node", ["src/server.js"], {
    cwd: path.join(__dirname),
    stdio: "ignore"
  });

  try {
    await wait(1500);

    const create = await api("/api/leagues", {
      method: "POST",
      body: JSON.stringify({
        leagueName: "Backend Smoke League",
        userName: "Ashu",
        teamName: "Ashu XI"
      })
    });

    const code = create.credentials.leagueCode;
    const ashuId = create.credentials.memberId;

    const join = await api(`/api/leagues/${code}/join`, {
      method: "POST",
      body: JSON.stringify({
        userName: "Rohit",
        teamName: "Rohit XI"
      })
    });

    const rohitId = join.credentials.memberId;

    await api(`/api/leagues/${code}/auction/start`, {
      method: "POST",
      body: JSON.stringify({ memberId: ashuId })
    });

    const ashuSocket = io(baseUrl, { transports: ["websocket"] });
    const rohitSocket = io(baseUrl, { transports: ["websocket"] });

    ashuSocket.emit("league:join", { leagueCode: code, memberId: ashuId });
    rohitSocket.emit("league:join", { leagueCode: code, memberId: rohitId });

    const firstState = await api(`/api/leagues/${code}?memberId=${ashuId}`);
    const firstPlayerId = firstState.auction.currentPlayer.id;
    const firstBid = firstState.auction.currentBid.amount;
    await emit(ashuSocket, "auction:bid", { leagueCode: code, memberId: ashuId, amount: firstBid });
    await emit(rohitSocket, "auction:pass", { leagueCode: code, memberId: rohitId });
    await emit(ashuSocket, "auction:pass", { leagueCode: code, memberId: ashuId });

    const secondState = await api(`/api/leagues/${code}?memberId=${rohitId}`);
    const secondPlayerId = secondState.auction.currentPlayer.id;
    const secondBid = secondState.auction.currentBid.amount;
    await emit(rohitSocket, "auction:bid", { leagueCode: code, memberId: rohitId, amount: secondBid });
    await emit(ashuSocket, "auction:pass", { leagueCode: code, memberId: ashuId });
    await emit(rohitSocket, "auction:pass", { leagueCode: code, memberId: rohitId });

    const thirdState = await api(`/api/leagues/${code}?memberId=${ashuId}`);
    const marketPlayerId = thirdState.auction.currentPlayer.id;
    await emit(ashuSocket, "auction:pass", { leagueCode: code, memberId: ashuId });
    await emit(rohitSocket, "auction:pass", { leagueCode: code, memberId: rohitId });

    await api("/api/admin/stats/import", {
      method: "POST",
      body: JSON.stringify({
        updates: [
          { playerId: firstPlayerId, pointsDelta: 80, matchesDelta: 2 },
          { playerId: secondPlayerId, pointsDelta: 60, matchesDelta: 2 }
        ]
      })
    });

    const tradeProposal = await api(`/api/leagues/${code}/trades`, {
      method: "POST",
      body: JSON.stringify({
        proposerMemberId: ashuId,
        partnerMemberId: rohitId,
        offeredPlayerIds: [firstPlayerId],
        requestedPlayerIds: [secondPlayerId]
      })
    });

    const tradeId = tradeProposal.pendingTrades[0].id;

    await api(`/api/leagues/${code}/trades/${tradeId}/respond`, {
      method: "POST",
      body: JSON.stringify({
        responderMemberId: rohitId,
        decision: "accept"
      })
    });

    await api("/api/admin/stats/import", {
      method: "POST",
      body: JSON.stringify({
        updates: [
          { playerId: secondPlayerId, pointsDelta: 30, matchesDelta: 2 }
        ]
      })
    });

    const swapState = await api(`/api/leagues/${code}?memberId=${ashuId}`);
    const outgoing = swapState.me.roster.find((player) => player.id === secondPlayerId);

    await api(`/api/leagues/${code}/market/swaps`, {
      method: "POST",
      body: JSON.stringify({
        memberId: ashuId,
        outgoingPlayerId: outgoing.id,
        incomingPlayerId: marketPlayerId
      })
    });

    const finalState = await api(`/api/leagues/${code}?memberId=${ashuId}`);

    console.log(
      JSON.stringify(
        {
          code,
          auctionStatus: finalState.auction.status,
          ashuRoster: finalState.me.roster.map((player) => player.name),
          ashuPoints: finalState.me.totalPoints,
          unsoldPlayers: finalState.unsoldPlayers.map((player) => player.name).slice(0, 3),
          pendingTrades: finalState.pendingTrades.length
        },
        null,
        2
      )
    );

    ashuSocket.close();
    rohitSocket.close();
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
