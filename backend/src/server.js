require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { ensureDb, readDb } = require("./utils/db");
const { createApiRouter } = require("./routes/api");
const { createAuctionRuntime } = require("./socket/register-socket-handlers");
const { CricApiService } = require("./services/cricapi-service");

ensureDb();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const auctionRuntime = createAuctionRuntime(io);
const cricApiService = new CricApiService();
const syncIntervalMinutes = Number(process.env.CRICAPI_SYNC_INTERVAL_MINUTES || 30);

app.use(cors());
app.use(express.json());
app.use("/api", createApiRouter(auctionRuntime, cricApiService));

app.use((err, req, res, next) => {
  const mappedErrors = {
    INVALID_LEAGUE_PAYLOAD: [400, "leagueName, userName, and teamName are required"],
    LEAGUE_NOT_FOUND: [404, "League not found"],
    LEAGUE_ALREADY_STARTED: [400, "This league has already started"],
    TEAM_NAME_TAKEN: [400, "That team name is already taken"],
    ONLY_OWNER: [403, "Only the league owner can start the auction"],
    MIN_TWO_MEMBERS: [400, "At least 2 teams are required to start"],
    AUCTION_ALREADY_STARTED: [400, "Auction has already started"],
    AUCTION_NOT_LIVE: [400, "Auction is not live"],
    MEMBER_NOT_FOUND: [404, "Member not found"],
    TEAM_FULL: [400, "This team is already full"],
    ALREADY_PASSED: [400, "You already passed on this player"],
    ALREADY_LEADING: [400, "You already have the highest bid"],
    BUDGET_EXCEEDED: [400, "Bid exceeds remaining budget"],
    INVALID_TRADE: [400, "Trade details are invalid"],
    TRADE_COUNT_MISMATCH: [400, "Both sides must exchange the same number of players"],
    PLAYER_NOT_OWNED: [400, "One or more players are not owned by that team"],
    PLAYER_NOT_TRADE_READY: [400, "Players must have played at least 2 matches since last trade"],
    PRICE_DIFF_TOO_HIGH: [400, "Price difference must be 3 Cr or less"],
    TEAM_COMPOSITION_BLOCKED: [400, "This move would break the minimum squad rule: 1 wicketkeeper, 3 batters, 3 bowlers"],
    TRADE_NOT_FOUND: [404, "Trade not found"],
    NOT_TRADE_PARTNER: [403, "Only the invited trade partner can respond"],
    MARKET_PLAYER_NOT_FOUND: [404, "Unsold market player not found"],
    CRICAPI_NOT_CONFIGURED: [400, "Set CRICAPI_KEY before syncing live CricAPI data"],
    CRICAPI_FETCH_FAILED: [502, "CricAPI request failed for this match"],
    MATCH_NOT_IPL: [400, "Only IPL matches are allowed for live sync"],
    MATCH_NOT_FOUND_OR_NOT_CURRENT: [404, "Match not found in the current CricAPI match list"]
  };

  if (typeof err.message === "string" && err.message.startsWith("MIN_BID:")) {
    return res.status(400).json({
      message: `Minimum valid bid is ${Number(err.message.split(":")[1]).toLocaleString("en-IN")}`
    });
  }

  if (mappedErrors[err.message]) {
    const [status, message] = mappedErrors[err.message];
    return res.status(status).json({ message });
  }

  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  readDb().leagues.forEach((league) => {
    auctionRuntime.sync(league.code);
  });

  if (cricApiService.isConfigured()) {
    const runSync = async () => {
      try {
        await cricApiService.syncCompletedIplMatches();
        auctionRuntime.broadcastAll();
      } catch (error) {
        console.error("CricAPI sync failed:", error.message);
      }
    };

    runSync();
    setInterval(runSync, syncIntervalMinutes * 60 * 1000);
  }
});
