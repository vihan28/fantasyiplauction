const fs = require("fs");
const path = require("path");
const {
  BID_TIMER_SECONDS,
  MIN_BID_INCREMENT,
  MAX_PRICE_DIFF,
  STARTING_BUDGET,
  TEAM_SIZE
} = require("../config/constants");

const LEGACY_DB_PATH = path.join(__dirname, "..", "data", "db.json");
const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");
const configuredDataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : DEFAULT_DATA_DIR;
const DB_PATH = process.env.DB_FILE_PATH
  ? path.resolve(process.env.DB_FILE_PATH)
  : path.join(configuredDataDir, "db.json");
const PLAYERS_PATH = path.join(__dirname, "..", "..", "..", "shared", "constants", "dummyPlayers.json");

function ensureDbDirectory() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function loadDummyPlayers() {
  return JSON.parse(fs.readFileSync(PLAYERS_PATH, "utf-8"));
}

function createDefaultDb() {
  const players = loadDummyPlayers();

  return {
    meta: {
      app: "Fantasy IPL Auction",
      startingBudget: STARTING_BUDGET,
      startingBudgetCrore: 100,
      teamSize: TEAM_SIZE,
      bidTimerSeconds: BID_TIMER_SECONDS,
      minBidIncrement: MIN_BID_INCREMENT,
      maxTradePriceDifference: MAX_PRICE_DIFF,
      minTeamComposition: {
        wicketkeepers: 1,
        batters: 3,
        bowlers: 3
      }
    },
    players,
    playerStats: Object.fromEntries(
      players.map((player) => [
        player.id,
        {
          playerId: player.id,
          matchesPlayed: 0,
          totalPoints: 0,
          updatedAt: null,
          processedMatches: {}
        }
      ])
    ),
    leagues: []
  };
}

function ensureDb() {
  ensureDbDirectory();

  if (!fs.existsSync(DB_PATH)) {
    if (DB_PATH !== LEGACY_DB_PATH && fs.existsSync(LEGACY_DB_PATH)) {
      fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
      return;
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(createDefaultDb(), null, 2));
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  let changed = false;

  if (!Array.isArray(db.players) || db.players.length === 0) {
    db.players = loadDummyPlayers();
    changed = true;
  }

  if (!db.meta) {
    db.meta = createDefaultDb().meta;
    changed = true;
  }
  if (!db.meta.minTeamComposition) {
    db.meta.minTeamComposition = createDefaultDb().meta.minTeamComposition;
    changed = true;
  }

  if (!db.playerStats || typeof db.playerStats !== "object") {
    db.playerStats = {};
    changed = true;
  }

  db.players.forEach((player) => {
    if (!db.playerStats[player.id]) {
      db.playerStats[player.id] = {
        playerId: player.id,
        matchesPlayed: 0,
        totalPoints: 0,
        updatedAt: null,
        processedMatches: {}
      };
      changed = true;
    }
  });

  if (!Array.isArray(db.leagues)) {
    db.leagues = [];
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDb(db) {
  const persisted = structuredClone(db);
  delete persisted._result;
  fs.writeFileSync(DB_PATH, JSON.stringify(persisted, null, 2));
}

function updateDb(updater) {
  const current = readDb();
  const updated = updater(structuredClone(current));
  writeDb(updated);
  return updated;
}

module.exports = {
  DB_PATH,
  ensureDb,
  readDb,
  writeDb,
  updateDb
};
