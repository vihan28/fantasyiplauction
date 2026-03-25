const axios = require("axios");
const { calculateFantasyPoints, toNumber } = require("./scoring-service");
const { readDb, writeDb } = require("../utils/db");

const DEFAULT_BASE_URL = process.env.CRICAPI_BASE_URL || "https://api.cricapi.com/v1";
const FALLBACK_FANTASY_URL = process.env.CRICAPI_FANTASY_URL || "https://www.cricapi.com/api/fantasySummary";
const IPL_INCLUDE_PATTERNS = [
  /\bindian premier league\b/i,
  /\bipl\b/i
];
const IPL_EXCLUDE_PATTERNS = [
  /\bwpl\b/i,
  /\bwomen'?s premier league\b/i,
  /\bchampions league\b/i,
  /\bsa20\b/i,
  /\bilt20\b/i,
  /\bbbl\b/i,
  /\bpsl\b/i,
  /\bcpl\b/i,
  /\bthe hundred\b/i
];

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function createBlankStatLine() {
  return {
    playingXI: false,
    runs: 0,
    fours: 0,
    sixes: 0,
    dismissed: false,
    ballsFaced: 0,
    strikeRate: 0,
    wickets: 0,
    lbwBowled: 0,
    maidenOvers: 0,
    oversBowled: 0,
    runsConceded: 0,
    economy: 0,
    catches: 0,
    stumpings: 0,
    runOutDirect: 0,
    runOutAssist: 0
  };
}

function ensureEntry(map, key) {
  const normalizedKey = normalizeName(key);
  if (!normalizedKey) return null;
  if (!map[normalizedKey]) {
    map[normalizedKey] = createBlankStatLine();
  }
  return map[normalizedKey];
}

function parseDismissal(info, statLine) {
  const text = String(info || "").trim();
  if (!text || text.toLowerCase() === "not out") return;
  statLine.dismissed = true;
}

function flattenScores(groups = []) {
  return groups.flatMap((group) => group || []);
}

function isCompletedMatch(match) {
  const status = String(match.status || match.matchStatus || "").toLowerCase();
  return [match.matchEnded, match.matchComplete, match.isComplete].some(Boolean) ||
    /(won|beat|result|completed|match over)/.test(status);
}

function isIplMatch(match) {
  const text = [
    match.name,
    match.series,
    match.seriesName,
    match.matchType,
    match.venue
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matchesInclude = IPL_INCLUDE_PATTERNS.some((pattern) => pattern.test(text));
  const matchesExclude = IPL_EXCLUDE_PATTERNS.some((pattern) => pattern.test(text));
  return matchesInclude && !matchesExclude;
}

function buildStatsFromFantasyPayload(payload) {
  const statMap = {};
  const teams = Array.isArray(payload.team) ? payload.team : [];
  const batting = Array.isArray(payload.batting) ? payload.batting : [];
  const bowling = Array.isArray(payload.bowling) ? payload.bowling : [];
  const fielding = Array.isArray(payload.fielding) ? payload.fielding : [];

  teams.forEach((team) => {
    (team.players || []).forEach((player) => {
      const entry = ensureEntry(statMap, player.name);
      if (entry) entry.playingXI = true;
    });
  });

  batting.forEach((innings) => {
    flattenScores(innings.scores).forEach((row) => {
      const entry = ensureEntry(statMap, row.batsman || row.name);
      if (!entry) return;

      entry.playingXI = true;
      entry.runs += toNumber(row.R || row.runs);
      entry.fours += toNumber(row["4s"] || row.fours);
      entry.sixes += toNumber(row["6s"] || row.sixes);
      entry.ballsFaced += toNumber(row.B || row.balls);
      entry.strikeRate = toNumber(row.SR || row.strikeRate);
      parseDismissal(row["dismissal-info"] || row.dismissal, entry);
    });
  });

  bowling.forEach((innings) => {
    flattenScores(innings.scores).forEach((row) => {
      const entry = ensureEntry(statMap, row.bowler || row.name);
      if (!entry) return;

      entry.playingXI = true;
      entry.oversBowled += toNumber(row.O || row.overs);
      entry.maidenOvers += toNumber(row.M || row.maidens);
      entry.runsConceded += toNumber(row.R || row.runs);
      entry.wickets += toNumber(row.W || row.wickets);
      entry.economy = toNumber(row.Econ || row.economy) || entry.economy;
    });
  });

  fielding.forEach((innings) => {
    flattenScores(innings.scores).forEach((row) => {
      const entry = ensureEntry(statMap, row.name || row.fielder);
      if (!entry) return;

      entry.playingXI = true;
      entry.catches += toNumber(row.catch || row.catches);
      entry.stumpings += toNumber(row.stumped || row.stumpings);
      entry.lbwBowled += toNumber(row.lbw) + toNumber(row.bowled);
      entry.runOutDirect += toNumber(row.runoutDirect || row["run out direct"]);
      entry.runOutAssist += toNumber(row.runoutAssist || row["run out assist"]);
    });
  });

  return statMap;
}

class CricApiService {
  constructor() {
    this.apiKey = process.env.CRICAPI_KEY || "";
    this.baseClient = axios.create({
      baseURL: DEFAULT_BASE_URL,
      timeout: 20000
    });
    this.fallbackClient = axios.create({
      timeout: 20000
    });
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async requestFantasySummary(matchId) {
    if (!this.apiKey) {
      throw new Error("CRICAPI_NOT_CONFIGURED");
    }

    const modernCandidates = [
      { url: "/fantasySummary", params: { apikey: this.apiKey, id: matchId } },
      { url: "/match_scorecard", params: { apikey: this.apiKey, id: matchId } }
    ];

    for (const candidate of modernCandidates) {
      try {
        const response = await this.baseClient.get(candidate.url, { params: candidate.params });
        const data = response.data?.data || response.data;
        if (data) return data;
      } catch (error) {
        continue;
      }
    }

    const fallbackCandidates = [
      { apikey: this.apiKey, unique_id: matchId },
      { apikey: this.apiKey, id: matchId }
    ];

    for (const params of fallbackCandidates) {
      try {
        const response = await this.fallbackClient.get(FALLBACK_FANTASY_URL, { params });
        const data = response.data?.data || response.data;
        if (data) return data;
      } catch (error) {
        continue;
      }
    }

    throw new Error("CRICAPI_FETCH_FAILED");
  }

  async getCompletedIplMatches() {
    if (!this.apiKey) {
      throw new Error("CRICAPI_NOT_CONFIGURED");
    }

    const response = await this.baseClient.get("/currentMatches", {
      params: {
        apikey: this.apiKey,
        offset: 0
      }
    });

    const matches = Array.isArray(response.data?.data) ? response.data.data : [];

    return matches.filter((match) => isIplMatch(match) && isCompletedMatch(match));
  }

  async getMatchMetadata(matchId) {
    const matches = await this.getCompletedIplMatches().catch(async () => {
      if (!this.apiKey) throw new Error("CRICAPI_NOT_CONFIGURED");

      const response = await this.baseClient.get("/currentMatches", {
        params: {
          apikey: this.apiKey,
          offset: 0
        }
      });

      return Array.isArray(response.data?.data) ? response.data.data : [];
    });

    return matches.find((match) => String(match.id || match.matchId || "") === String(matchId)) || null;
  }

  async syncMatch(matchId) {
      const match = await this.getMatchMetadata(matchId);
      if (!match) {
        throw new Error("MATCH_NOT_FOUND_OR_NOT_CURRENT");
      }
      if (!isIplMatch(match)) {
        throw new Error("MATCH_NOT_IPL");
      }

      const payload = await this.requestFantasySummary(matchId);
      const db = readDb();
      const statMap = buildStatsFromFantasyPayload(payload);
      const playersByName = db.players.reduce((accumulator, player) => {
        const key = normalizeName(player.name);
        accumulator[key] = accumulator[key] || [];
        accumulator[key].push(player);
        return accumulator;
      }, {});

      Object.entries(statMap).forEach(([name, statLine]) => {
        const matchedPlayers = playersByName[name] || [];
        if (!matchedPlayers.length) return;

        matchedPlayers.forEach((player) => {
          const current = db.playerStats[player.id] || {
            playerId: player.id,
            matchesPlayed: 0,
            totalPoints: 0,
            updatedAt: null,
            processedMatches: {}
          };

          current.processedMatches = current.processedMatches || {};
          if (current.processedMatches[matchId]) {
            return;
          }

          const points = calculateFantasyPoints(statLine);
          current.matchesPlayed += 1;
          current.totalPoints += points;
          current.updatedAt = new Date().toISOString();
          current.processedMatches[matchId] = {
            points,
            stats: statLine
          };

          db.playerStats[player.id] = current;

          db.leagues.forEach((league) => {
            league.members.forEach((member) => {
              if (member.roster.some((entry) => entry.playerId === player.id)) {
                member.totalPoints += points;
              }
            });
          });
        });
      });

      writeDb(db);
      return { syncedMatchId: matchId };
  }

  async syncCompletedIplMatches() {
    const matches = await this.getCompletedIplMatches();
    const results = [];

    for (const match of matches) {
      const matchId = String(match.id || match.matchId || "");
      if (!matchId) continue;
      results.push(await this.syncMatch(matchId));
    }

    return {
      syncedMatches: results.map((item) => item.syncedMatchId)
    };
  }
}

function getScoringSummary() {
  return {
    source: "User-confirmed fantasy rules",
    rules: require("./scoring-service").SCORING_RULES
  };
}

module.exports = {
  CricApiService,
  getScoringSummary
};
