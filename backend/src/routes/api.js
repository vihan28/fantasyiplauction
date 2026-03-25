const express = require("express");
const {
  createLeague,
  joinLeague,
  deleteLeague,
  startAuction,
  proposeTrade,
  respondToTrade,
  swapWithMarket,
  importPlayerStats,
  getLeagueSnapshot,
  getLeaderboard
} = require("../services/league-service");
const { getScoringSummary } = require("../services/cricapi-service");

function createApiRouter(auctionRuntime, cricApiService) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  router.get("/scoring", (req, res) => {
    res.json(getScoringSummary());
  });

  router.post("/leagues", (req, res, next) => {
    try {
      const db = createLeague(req.body);
      const result = db._result;

      res.status(201).json({
        credentials: result,
        snapshot: getLeagueSnapshot(result.leagueCode, result.memberId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/leagues/:code/join", (req, res, next) => {
    try {
      const db = joinLeague({
        leagueCode: req.params.code,
        ...req.body
      });
      const result = db._result;

      auctionRuntime.broadcast(req.params.code);

      res.status(201).json({
        credentials: {
          leagueCode: String(req.params.code).toUpperCase(),
          memberId: result.memberId
        },
        snapshot: getLeagueSnapshot(req.params.code, result.memberId)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leagues/:code", (req, res, next) => {
    try {
      res.json(getLeagueSnapshot(req.params.code, req.query.memberId));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/leagues/:code", (req, res, next) => {
    try {
      deleteLeague({
        leagueCode: req.params.code,
        memberId: req.query.memberId || req.body?.memberId
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/leagues/:code/leaderboard", (req, res, next) => {
    try {
      res.json(getLeaderboard(req.params.code));
    } catch (error) {
      next(error);
    }
  });

  router.post("/leagues/:code/auction/start", (req, res, next) => {
    try {
      startAuction({
        leagueCode: req.params.code,
        memberId: req.body.memberId
      });
      auctionRuntime.sync(req.params.code);
      res.json(getLeagueSnapshot(req.params.code, req.body.memberId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/leagues/:code/market/swaps", (req, res, next) => {
    try {
      swapWithMarket({
        leagueCode: req.params.code,
        ...req.body
      });
      auctionRuntime.broadcast(req.params.code);
      res.json(getLeagueSnapshot(req.params.code, req.body.memberId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/leagues/:code/trades", (req, res, next) => {
    try {
      proposeTrade({
        leagueCode: req.params.code,
        ...req.body
      });
      auctionRuntime.broadcast(req.params.code);
      res.json(getLeagueSnapshot(req.params.code, req.body.proposerMemberId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/leagues/:code/trades/:tradeId/respond", (req, res, next) => {
    try {
      respondToTrade({
        leagueCode: req.params.code,
        tradeId: req.params.tradeId,
        responderMemberId: req.body.responderMemberId,
        decision: req.body.decision
      });
      auctionRuntime.broadcast(req.params.code);
      res.json(getLeagueSnapshot(req.params.code, req.body.responderMemberId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/stats/import", (req, res, next) => {
    try {
      importPlayerStats({
        updates: req.body.updates || []
      });
      auctionRuntime.broadcastAll();
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/cricapi/sync-match", async (req, res, next) => {
    try {
      const result = await cricApiService.syncMatch(req.body.matchId);
      auctionRuntime.broadcastAll();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/cricapi/sync-ipl", async (req, res, next) => {
    try {
      const result = await cricApiService.syncCompletedIplMatches();
      auctionRuntime.broadcastAll();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createApiRouter
};
