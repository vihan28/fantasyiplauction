const SCORING_RULES = {
  playingXI: 4,
  batting: {
    run: 1,
    fourBonus: 1,
    sixBonus: 2,
    milestone25: 4,
    milestone50: 8,
    milestone75: 12,
    milestone100: 16,
    duck: -2
  },
  bowling: {
    wicket: 25,
    lbwBowledBonus: 8,
    threeWickets: 4,
    fourWickets: 8,
    fiveWickets: 12,
    maiden: 12
  },
  strikeRate: [
    { max: 50, points: -6 },
    { max: 60, points: -4 },
    { max: 70, points: -2 },
    { max: 130, points: 0 },
    { max: 150, points: 2 },
    { max: 170, points: 4 },
    { max: Infinity, points: 6 }
  ],
  economy: [
    { max: 5, points: 6 },
    { max: 6, points: 4 },
    { max: 7, points: 2 },
    { max: 10.000001, points: 0 },
    { max: 11.000001, points: -2 },
    { max: 12.000001, points: -4 },
    { max: Infinity, points: -6 }
  ],
  fielding: {
    catch: 8,
    threeCatchBonus: 4,
    stumping: 12,
    runOutDirect: 12,
    runOutAssist: 6
  }
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateRangePoints(value, rules) {
  const numeric = toNumber(value);
  const match = rules.find((rule) => numeric < rule.max);
  return match ? match.points : 0;
}

function calculateFantasyPoints(statLine = {}) {
  let total = 0;
  const runs = toNumber(statLine.runs);
  const fours = toNumber(statLine.fours);
  const sixes = toNumber(statLine.sixes);
  const wickets = toNumber(statLine.wickets);
  const catches = toNumber(statLine.catches);
  const ballsFaced = toNumber(statLine.ballsFaced);
  const oversBowled = toNumber(statLine.oversBowled);
  const strikeRate = statLine.strikeRate ?? (ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0);
  const economy = statLine.economy ?? (oversBowled > 0 ? toNumber(statLine.runsConceded) / oversBowled : 0);

  if (statLine.playingXI) total += SCORING_RULES.playingXI;

  total += runs * SCORING_RULES.batting.run;
  total += fours * SCORING_RULES.batting.fourBonus;
  total += sixes * SCORING_RULES.batting.sixBonus;

  if (runs >= 25) total += SCORING_RULES.batting.milestone25;
  if (runs >= 50) total += SCORING_RULES.batting.milestone50;
  if (runs >= 75) total += SCORING_RULES.batting.milestone75;
  if (runs >= 100) total += SCORING_RULES.batting.milestone100;
  if (runs === 0 && statLine.dismissed) total += SCORING_RULES.batting.duck;

  if (ballsFaced > 0) {
    total += calculateRangePoints(strikeRate, SCORING_RULES.strikeRate);
  }

  total += wickets * SCORING_RULES.bowling.wicket;
  total += toNumber(statLine.lbwBowled) * SCORING_RULES.bowling.lbwBowledBonus;
  if (wickets >= 3) total += SCORING_RULES.bowling.threeWickets;
  if (wickets >= 4) total += SCORING_RULES.bowling.fourWickets;
  if (wickets >= 5) total += SCORING_RULES.bowling.fiveWickets;
  total += toNumber(statLine.maidenOvers) * SCORING_RULES.bowling.maiden;

  if (oversBowled > 0) {
    total += calculateRangePoints(economy, SCORING_RULES.economy);
  }

  total += catches * SCORING_RULES.fielding.catch;
  if (catches >= 3) total += SCORING_RULES.fielding.threeCatchBonus;
  total += toNumber(statLine.stumpings) * SCORING_RULES.fielding.stumping;
  total += toNumber(statLine.runOutDirect) * SCORING_RULES.fielding.runOutDirect;
  total += toNumber(statLine.runOutAssist) * SCORING_RULES.fielding.runOutAssist;

  return Math.round(total * 100) / 100;
}

module.exports = {
  SCORING_RULES,
  calculateFantasyPoints,
  toNumber
};
