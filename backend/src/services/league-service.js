const crypto = require("crypto");
const { updateDb, readDb } = require("../utils/db");

function createId() {
  return crypto.randomUUID();
}

function createCode(existingCodes) {
  let code = "";
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (existingCodes.has(code));
  return code;
}

function nowIso() {
  return new Date().toISOString();
}

function getLeague(db, leagueCode) {
  return db.leagues.find((league) => league.code === String(leagueCode).toUpperCase());
}

function getMember(league, memberId) {
  return league.members.find((member) => member.id === memberId);
}

function getPlayer(db, playerId) {
  return db.players.find((player) => player.id === playerId);
}

function getPlayerStats(db, playerId) {
  return db.playerStats[playerId] || {
    playerId,
    matchesPlayed: 0,
    totalPoints: 0,
    updatedAt: null
  };
}

function getRosterEntry(member, playerId) {
  return member.roster.find((entry) => entry.playerId === playerId);
}

function getRosterPlayers(db, member) {
  return member.roster
    .map((entry) => getPlayer(db, entry.playerId))
    .filter(Boolean);
}

function getCompositionCounts(players) {
  return players.reduce(
    (counts, player) => {
      if (player.role === "Wicketkeeper") counts.wicketkeepers += 1;
      else if (player.role === "Batter") counts.batters += 1;
      else if (player.role === "Bowler") counts.bowlers += 1;
      else if (player.role === "All-Rounder") counts.allRounders += 1;
      return counts;
    },
    {
      wicketkeepers: 0,
      batters: 0,
      bowlers: 0,
      allRounders: 0
    }
  );
}

function getMinimumAdditionalPlayersNeeded(db, players) {
  const counts = getCompositionCounts(players);
  const minimums = db.meta.minTeamComposition;
  const wicketkeeperShortage = Math.max(0, minimums.wicketkeepers - counts.wicketkeepers);
  const batterShortage = Math.max(0, minimums.batters - counts.batters);
  const bowlerShortage = Math.max(0, minimums.bowlers - counts.bowlers);
  const flexCovered = Math.min(counts.allRounders, batterShortage + bowlerShortage);
  const remainingSpecialistShortage = batterShortage + bowlerShortage - flexCovered;
  return wicketkeeperShortage + remainingSpecialistShortage;
}

function canStillMeetComposition(db, players) {
  const remainingSlots = db.meta.teamSize - players.length;
  return remainingSlots >= getMinimumAdditionalPlayersNeeded(db, players);
}

function assertRosterCompositionPossible(db, players) {
  if (!canStillMeetComposition(db, players)) {
    throw new Error("TEAM_COMPOSITION_BLOCKED");
  }
}

function memberHasRoom(db, member) {
  return member.roster.length < db.meta.teamSize;
}

function getEligibleMemberIds(db, league) {
  return league.members.filter((member) => memberHasRoom(db, member)).map((member) => member.id);
}

function minimumNextBid(db, auction) {
  if (!auction.currentBid.bidderMemberId) {
    return auction.currentBid.amount;
  }

  return auction.currentBid.amount + db.meta.minBidIncrement;
}

function getTierRank(tier) {
  const normalized = String(tier || "").trim().toUpperCase();
  if (normalized === "A") return 1;
  if (normalized === "B") return 2;
  if (normalized === "C") return 3;
  return 99;
}

function pickNextPlayerIdByTier(db, playerIds) {
  const availablePlayers = playerIds
    .map((playerId) => getPlayer(db, playerId))
    .filter(Boolean);

  if (!availablePlayers.length) {
    return null;
  }

  const bestRank = Math.min(...availablePlayers.map((player) => getTierRank(player.tier)));
  const bestTierPlayers = availablePlayers.filter((player) => getTierRank(player.tier) === bestRank);
  const chosen = bestTierPlayers[Math.floor(Math.random() * bestTierPlayers.length)];
  return chosen?.id || null;
}

function allTeamsComplete(db, league) {
  return league.members.every((member) => member.roster.length >= db.meta.teamSize);
}

function undecidedPlayers(league) {
  const decided = new Set([
    ...league.auction.soldPlayerIds,
    ...league.auction.unsoldPlayerIds
  ]);

  return league.auction.queue.filter((playerId) => !decided.has(playerId));
}

function setNextAuctionPlayer(db, league) {
  const nextPlayerId = pickNextPlayerIdByTier(db, undecidedPlayers(league));

  if (!nextPlayerId) {
    league.auction.status = "complete";
    league.status = "auction-complete";
    league.auction.currentPlayerId = null;
    league.auction.expiresAt = null;
    league.auction.currentBid = {
      amount: 0,
      bidderMemberId: null,
      bidderTeamName: null
    };
    return false;
  }

  const player = getPlayer(db, nextPlayerId);
  league.auction.currentPlayerId = nextPlayerId;
  league.auction.currentBid = {
    amount: player.basePrice,
    bidderMemberId: null,
    bidderTeamName: null
  };
  league.auction.passedMemberIds = [];
  league.auction.expiresAt = new Date(Date.now() + db.meta.bidTimerSeconds * 1000).toISOString();
  return true;
}

function forceCompleteAuction(db, league, reason) {
  const remaining = undecidedPlayers(league).filter(
    (playerId) => playerId !== league.auction.currentPlayerId
  );

  remaining.forEach((playerId) => {
    if (!league.auction.unsoldPlayerIds.includes(playerId)) {
      league.auction.unsoldPlayerIds.push(playerId);
    }
  });

  league.auction.status = "complete";
  league.status = "auction-complete";
  league.auction.expiresAt = null;
  league.auction.currentPlayerId = null;
  league.auction.currentBid = {
    amount: 0,
    bidderMemberId: null,
    bidderTeamName: null
  };
  league.auction.history.push({
    id: createId(),
    type: "auction-ended",
    reason,
    timestamp: nowIso()
  });
}

function concludeCurrentPlayer(db, league, reason) {
  const playerId = league.auction.currentPlayerId;
  if (!playerId) return;

  const player = getPlayer(db, playerId);
  const bid = league.auction.currentBid;

  if (bid.bidderMemberId) {
    const winner = getMember(league, bid.bidderMemberId);

    if (winner && memberHasRoom(db, winner)) {
      const nextEntry = {
        playerId,
        purchasePrice: bid.amount,
        acquiredAt: nowIso(),
        acquiredAtMatchesPlayed: getPlayerStats(db, playerId).matchesPlayed,
        acquiredVia: "auction"
      };
      const nextPlayers = [...getRosterPlayers(db, winner), player];

      if (!canStillMeetComposition(db, nextPlayers)) {
        league.auction.unsoldPlayerIds.push(playerId);
        league.auction.history.push({
          id: createId(),
          type: "unsold",
          playerId,
          playerName: player.name,
          reason: "composition-blocked",
          timestamp: nowIso()
        });
        return;
      }

      winner.roster.push(nextEntry);
      winner.budgetRemaining -= bid.amount;
    }

    league.auction.soldPlayerIds.push(playerId);
    league.auction.history.push({
      id: createId(),
      type: "sold",
      playerId,
      playerName: player.name,
      winnerMemberId: bid.bidderMemberId,
      winnerTeamName: bid.bidderTeamName,
      amount: bid.amount,
      reason,
      timestamp: nowIso()
    });
  } else {
    league.auction.unsoldPlayerIds.push(playerId);
    league.auction.history.push({
      id: createId(),
      type: "unsold",
      playerId,
      playerName: player.name,
      reason,
      timestamp: nowIso()
    });
  }

  if (allTeamsComplete(db, league)) {
    forceCompleteAuction(db, league, "all-teams-full");
    return;
  }

  if (getEligibleMemberIds(db, league).length === 0) {
    forceCompleteAuction(db, league, "no-eligible-members");
    return;
  }

  setNextAuctionPlayer(db, league);
}

function serializeLeague(db, league, memberId) {
  const me = memberId ? getMember(league, memberId) : null;
  const currentPlayer = league.auction.currentPlayerId
    ? getPlayer(db, league.auction.currentPlayerId)
    : null;

  const soldTo = Object.fromEntries(
    league.members.flatMap((member) =>
      member.roster.map((entry) => [entry.playerId, member.teamName])
    )
  );

  return {
    league: {
      id: league.id,
      name: league.name,
      code: league.code,
      status: league.status,
      ownerMemberId: league.ownerMemberId
    },
    config: db.meta,
    me: me
      ? {
          id: me.id,
          userName: me.userName,
          teamName: me.teamName,
          budgetRemaining: me.budgetRemaining,
          totalPoints: me.totalPoints,
          roster: me.roster.map((entry) => {
            const player = getPlayer(db, entry.playerId);
            return {
              ...entry,
              ...player,
              currentSeasonPoints: getPlayerStats(db, entry.playerId).totalPoints
            };
          }),
          hasPassedCurrentPlayer: league.auction.passedMemberIds.includes(me.id)
        }
      : null,
    members: league.members.map((member) => ({
      id: member.id,
      userName: member.userName,
      teamName: member.teamName,
      budgetRemaining: member.budgetRemaining,
      rosterSize: member.roster.length,
      totalPoints: member.totalPoints
    })),
    auction: {
      status: league.auction.status,
      currentPlayer,
      currentBid: league.auction.currentBid,
      expiresAt: league.auction.expiresAt,
      soldCount: league.auction.soldPlayerIds.length,
      unsoldCount: league.auction.unsoldPlayerIds.length,
      queueSize: league.auction.queue.length,
      history: league.auction.history.slice(-10)
    },
    unsoldPlayers: league.auction.unsoldPlayerIds.map((playerId) => getPlayer(db, playerId)),
    pendingTrades: league.pendingTrades
      .filter((trade) => trade.status === "pending")
      .map((trade) => ({
        id: trade.id,
        proposerMemberId: trade.proposerMemberId,
        proposerTeamName: getMember(league, trade.proposerMemberId)?.teamName,
        partnerMemberId: trade.partnerMemberId,
        partnerTeamName: getMember(league, trade.partnerMemberId)?.teamName,
        offeredPlayers: trade.offeredPlayerIds.map((playerId) => getPlayer(db, playerId)),
        requestedPlayers: trade.requestedPlayerIds.map((playerId) => getPlayer(db, playerId))
      })),
    players: db.players.map((player) => ({
      ...player,
      soldTo: soldTo[player.id] || null,
      seasonPoints: getPlayerStats(db, player.id).totalPoints
    })),
    playersByTier: db.players
      .slice()
      .sort((left, right) => {
        const rankDiff = getTierRank(left.tier) - getTierRank(right.tier);
        if (rankDiff !== 0) return rankDiff;
        return left.name.localeCompare(right.name);
      })
      .reduce((groups, player) => {
        const tier = String(player.tier || "").toUpperCase();
        groups[tier] = groups[tier] || [];
        groups[tier].push({
          ...player,
          soldTo: soldTo[player.id] || null,
          seasonPoints: getPlayerStats(db, player.id).totalPoints
        });
        return groups;
      }, {})
  };
}

function createLeague({ leagueName, userName, teamName }) {
  return updateDb((db) => {
    if (!leagueName || !userName || !teamName) throw new Error("INVALID_LEAGUE_PAYLOAD");

    const code = createCode(new Set(db.leagues.map((league) => league.code)));
    const memberId = createId();

    db.leagues.push({
      id: createId(),
      code,
      name: leagueName.trim(),
      status: "lobby",
      ownerMemberId: memberId,
      createdAt: nowIso(),
      members: [
        {
          id: memberId,
          userName: userName.trim(),
          teamName: teamName.trim(),
          budgetRemaining: db.meta.startingBudget,
          totalPoints: 0,
          roster: []
        }
      ],
      auction: {
        status: "pending",
        queue: db.players.map((player) => player.id),
        currentPlayerId: null,
        currentBid: {
          amount: 0,
          bidderMemberId: null,
          bidderTeamName: null
        },
        passedMemberIds: [],
        soldPlayerIds: [],
        unsoldPlayerIds: [],
        expiresAt: null,
        history: []
      },
      pendingTrades: []
    });

    db._result = { leagueCode: code, memberId };
    return db;
  });
}

function joinLeague({ leagueCode, userName, teamName }) {
  return updateDb((db) => {
    if (!userName || !teamName) throw new Error("INVALID_LEAGUE_PAYLOAD");

    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (league.status !== "lobby") throw new Error("LEAGUE_ALREADY_STARTED");
    if (league.members.some((member) => member.teamName.toLowerCase() === teamName.trim().toLowerCase())) {
      throw new Error("TEAM_NAME_TAKEN");
    }

    const memberId = createId();
    league.members.push({
      id: memberId,
      userName: userName.trim(),
      teamName: teamName.trim(),
      budgetRemaining: db.meta.startingBudget,
      totalPoints: 0,
      roster: []
    });
    db._result = { memberId };
    return db;
  });
}

function deleteLeague({ leagueCode, memberId }) {
  return updateDb((db) => {
    const leagueIndex = db.leagues.findIndex(
      (league) => league.code === String(leagueCode).toUpperCase()
    );
    if (leagueIndex === -1) throw new Error("LEAGUE_NOT_FOUND");

    const league = db.leagues[leagueIndex];
    if (league.ownerMemberId !== memberId) throw new Error("ONLY_OWNER");

    db.leagues.splice(leagueIndex, 1);
    return db;
  });
}

function startAuction({ leagueCode, memberId }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (league.ownerMemberId !== memberId) throw new Error("ONLY_OWNER");
    if (league.members.length < 2) throw new Error("MIN_TWO_MEMBERS");
    if (league.auction.status !== "pending") throw new Error("AUCTION_ALREADY_STARTED");

    league.status = "auction-live";
    league.auction.status = "live";
    setNextAuctionPlayer(db, league);
    return db;
  });
}

function placeBid({ leagueCode, memberId, amount }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (league.auction.status !== "live") throw new Error("AUCTION_NOT_LIVE");

    const member = getMember(league, memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (!memberHasRoom(db, member)) throw new Error("TEAM_FULL");
    if (league.auction.passedMemberIds.includes(memberId)) throw new Error("ALREADY_PASSED");
    if (league.auction.currentBid.bidderMemberId === memberId) throw new Error("ALREADY_LEADING");

    const minBid = minimumNextBid(db, league.auction);
    if (Number(amount) < minBid) throw new Error(`MIN_BID:${minBid}`);
    if (Number(amount) > member.budgetRemaining) throw new Error("BUDGET_EXCEEDED");

    const currentPlayer = getPlayer(db, league.auction.currentPlayerId);
    assertRosterCompositionPossible(db, [...getRosterPlayers(db, member), currentPlayer]);

    league.auction.currentBid = {
      amount: Number(amount),
      bidderMemberId: memberId,
      bidderTeamName: member.teamName
    };
    league.auction.expiresAt = new Date(Date.now() + db.meta.bidTimerSeconds * 1000).toISOString();
    league.auction.history.push({
      id: createId(),
      type: "bid",
      playerId: league.auction.currentPlayerId,
      memberId,
      teamName: member.teamName,
      amount: Number(amount),
      timestamp: nowIso()
    });
    return db;
  });
}

function passPlayer({ leagueCode, memberId }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");
    if (league.auction.status !== "live") throw new Error("AUCTION_NOT_LIVE");

    const member = getMember(league, memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (!memberHasRoom(db, member)) throw new Error("TEAM_FULL");
    if (league.auction.passedMemberIds.includes(memberId)) throw new Error("ALREADY_PASSED");

    league.auction.passedMemberIds.push(memberId);
    league.auction.history.push({
      id: createId(),
      type: "pass",
      playerId: league.auction.currentPlayerId,
      memberId,
      teamName: member.teamName,
      timestamp: nowIso()
    });

    const eligibleMemberIds = getEligibleMemberIds(db, league);
    const everybodyPassed = eligibleMemberIds.every((id) =>
      league.auction.passedMemberIds.includes(id)
    );

    if (everybodyPassed) {
      concludeCurrentPlayer(db, league, "all-passed");
    }

    return db;
  });
}

function concludeAuctionPlayerByTimer({ leagueCode }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league || league.auction.status !== "live") return db;
    concludeCurrentPlayer(db, league, "timer");
    return db;
  });
}

function ensureTradable(db, member, playerId) {
  const entry = getRosterEntry(member, playerId);
  if (!entry) throw new Error("PLAYER_NOT_OWNED");

  const matchesSinceTrade =
    getPlayerStats(db, playerId).matchesPlayed - entry.acquiredAtMatchesPlayed;
  if (matchesSinceTrade < 2) throw new Error("PLAYER_NOT_TRADE_READY");

  return entry;
}

function proposeTrade({ leagueCode, proposerMemberId, partnerMemberId, offeredPlayerIds, requestedPlayerIds }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");

    const proposer = getMember(league, proposerMemberId);
    const partner = getMember(league, partnerMemberId);
    if (!proposer || !partner) throw new Error("MEMBER_NOT_FOUND");
    if (!Array.isArray(offeredPlayerIds) || !Array.isArray(requestedPlayerIds) || offeredPlayerIds.length === 0) {
      throw new Error("INVALID_TRADE");
    }
    if (offeredPlayerIds.length !== requestedPlayerIds.length) throw new Error("TRADE_COUNT_MISMATCH");

    const offeredEntries = offeredPlayerIds.map((playerId) => ensureTradable(db, proposer, playerId));
    const requestedEntries = requestedPlayerIds.map((playerId) => ensureTradable(db, partner, playerId));
    const offeredTotal = offeredEntries.reduce((sum, entry) => sum + entry.purchasePrice, 0);
    const requestedTotal = requestedEntries.reduce((sum, entry) => sum + entry.purchasePrice, 0);

    if (Math.abs(offeredTotal - requestedTotal) > db.meta.maxTradePriceDifference) {
      throw new Error("PRICE_DIFF_TOO_HIGH");
    }

    league.pendingTrades.push({
      id: createId(),
      status: "pending",
      proposerMemberId,
      partnerMemberId,
      offeredPlayerIds,
      requestedPlayerIds,
      createdAt: nowIso()
    });

    return db;
  });
}

function respondToTrade({ leagueCode, tradeId, responderMemberId, decision }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");

    const trade = league.pendingTrades.find((item) => item.id === tradeId);
    if (!trade || trade.status !== "pending") throw new Error("TRADE_NOT_FOUND");
    if (trade.partnerMemberId !== responderMemberId) throw new Error("NOT_TRADE_PARTNER");

    if (decision === "reject") {
      trade.status = "rejected";
      trade.resolvedAt = nowIso();
      return db;
    }

    const proposer = getMember(league, trade.proposerMemberId);
    const partner = getMember(league, trade.partnerMemberId);
    const offeredEntries = trade.offeredPlayerIds.map((playerId) => ensureTradable(db, proposer, playerId));
    const requestedEntries = trade.requestedPlayerIds.map((playerId) => ensureTradable(db, partner, playerId));

    const nextProposerRoster = proposer.roster.filter(
      (entry) => !trade.offeredPlayerIds.includes(entry.playerId)
    );
    const nextPartnerRoster = partner.roster.filter(
      (entry) => !trade.requestedPlayerIds.includes(entry.playerId)
    );

    requestedEntries.forEach((entry) => {
      nextProposerRoster.push({
        ...entry,
        acquiredAt: nowIso(),
        acquiredAtMatchesPlayed: getPlayerStats(db, entry.playerId).matchesPlayed,
        acquiredVia: "trade"
      });
    });

    offeredEntries.forEach((entry) => {
      nextPartnerRoster.push({
        ...entry,
        acquiredAt: nowIso(),
        acquiredAtMatchesPlayed: getPlayerStats(db, entry.playerId).matchesPlayed,
        acquiredVia: "trade"
      });
    });

    assertRosterCompositionPossible(
      db,
      nextProposerRoster.map((entry) => getPlayer(db, entry.playerId))
    );
    assertRosterCompositionPossible(
      db,
      nextPartnerRoster.map((entry) => getPlayer(db, entry.playerId))
    );

    proposer.roster = nextProposerRoster;
    partner.roster = nextPartnerRoster;

    trade.status = "accepted";
    trade.resolvedAt = nowIso();
    return db;
  });
}

function swapWithMarket({ leagueCode, memberId, outgoingPlayerId, incomingPlayerId }) {
  return updateDb((db) => {
    const league = getLeague(db, leagueCode);
    if (!league) throw new Error("LEAGUE_NOT_FOUND");

    const member = getMember(league, memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    if (!league.auction.unsoldPlayerIds.includes(incomingPlayerId)) throw new Error("MARKET_PLAYER_NOT_FOUND");

    const outgoingEntry = ensureTradable(db, member, outgoingPlayerId);
    const incomingPlayer = getPlayer(db, incomingPlayerId);

    if (Math.abs(outgoingEntry.purchasePrice - incomingPlayer.basePrice) > db.meta.maxTradePriceDifference) {
      throw new Error("PRICE_DIFF_TOO_HIGH");
    }

    const nextRoster = member.roster.filter((entry) => entry.playerId !== outgoingPlayerId);
    nextRoster.push({
      playerId: incomingPlayerId,
      purchasePrice: incomingPlayer.basePrice,
      acquiredAt: nowIso(),
      acquiredAtMatchesPlayed: getPlayerStats(db, incomingPlayerId).matchesPlayed,
      acquiredVia: "market-swap"
    });
    assertRosterCompositionPossible(
      db,
      nextRoster.map((entry) => getPlayer(db, entry.playerId))
    );
    member.roster = nextRoster;

    league.auction.unsoldPlayerIds = league.auction.unsoldPlayerIds.filter(
      (playerId) => playerId !== incomingPlayerId
    );
    if (!league.auction.unsoldPlayerIds.includes(outgoingPlayerId)) {
      league.auction.unsoldPlayerIds.push(outgoingPlayerId);
    }

    league.auction.history.push({
      id: createId(),
      type: "market-swap",
      memberId,
      teamName: member.teamName,
      outgoingPlayerId,
      incomingPlayerId,
      timestamp: nowIso()
    });

    return db;
  });
}

function importPlayerStats({ updates }) {
  return updateDb((db) => {
    updates.forEach((update) => {
      const stats = getPlayerStats(db, update.playerId);
      const pointsDelta = Number(update.pointsDelta || 0);
      const matchesDelta = Number(update.matchesDelta || 0);

      stats.totalPoints += pointsDelta;
      stats.matchesPlayed += matchesDelta;
      stats.updatedAt = nowIso();
      db.playerStats[update.playerId] = stats;

      db.leagues.forEach((league) => {
        league.members.forEach((member) => {
          if (member.roster.some((entry) => entry.playerId === update.playerId)) {
            member.totalPoints += pointsDelta;
          }
        });
      });
    });

    return db;
  });
}

function getLeagueSnapshot(leagueCode, memberId) {
  const db = readDb();
  const league = getLeague(db, leagueCode);
  if (!league) throw new Error("LEAGUE_NOT_FOUND");
  return serializeLeague(db, league, memberId);
}

function getLeaderboard(leagueCode) {
  const db = readDb();
  const league = getLeague(db, leagueCode);
  if (!league) throw new Error("LEAGUE_NOT_FOUND");

  return [...league.members]
    .map((member) => ({
      id: member.id,
      userName: member.userName,
      teamName: member.teamName,
      totalPoints: member.totalPoints,
      rosterSize: member.roster.length,
      budgetRemaining: member.budgetRemaining
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints);
}

function getAuctionRuntimeState(leagueCode) {
  const db = readDb();
  const league = getLeague(db, leagueCode);
  if (!league) return null;
  return {
    status: league.auction.status,
    expiresAt: league.auction.expiresAt,
    currentPlayerId: league.auction.currentPlayerId
  };
}

module.exports = {
  createLeague,
  joinLeague,
  deleteLeague,
  startAuction,
  placeBid,
  passPlayer,
  concludeAuctionPlayerByTimer,
  proposeTrade,
  respondToTrade,
  swapWithMarket,
  importPlayerStats,
  getLeagueSnapshot,
  getLeaderboard,
  getAuctionRuntimeState
};
