const now = Date.now();

const players = [
  {
    id: "virat-kohli-rcb",
    name: "Virat Kohli",
    basePrice: 50000000,
    tier: "A",
    role: "Batter",
    team: "RCB",
    soldTo: "Night Riders",
    seasonPoints: 412
  },
  {
    id: "jasprit-bumrah-mi",
    name: "Jasprit Bumrah",
    basePrice: 50000000,
    tier: "A",
    role: "Bowler",
    team: "MI",
    soldTo: "Thunder XI",
    seasonPoints: 365
  },
  {
    id: "kl-rahul-dc",
    name: "KL Rahul",
    basePrice: 50000000,
    tier: "A",
    role: "Wicketkeeper",
    team: "DC",
    soldTo: "Night Riders",
    seasonPoints: 288
  },
  {
    id: "ravindra-jadeja-csk",
    name: "Ravindra Jadeja",
    basePrice: 50000000,
    tier: "A",
    role: "All-Rounder",
    team: "CSK",
    soldTo: "Boundary Hunters",
    seasonPoints: 301
  },
  {
    id: "yashasvi-jaiswal-rr",
    name: "Yashasvi Jaiswal",
    basePrice: 30000000,
    tier: "B",
    role: "Batter",
    team: "RR",
    soldTo: null,
    seasonPoints: 0
  },
  {
    id: "mohammed-siraj-gt",
    name: "Mohammed Siraj",
    basePrice: 30000000,
    tier: "B",
    role: "Bowler",
    team: "GT",
    soldTo: "Boundary Hunters",
    seasonPoints: 210
  },
  {
    id: "rinku-singh-kkr",
    name: "Rinku Singh",
    basePrice: 20000000,
    tier: "C",
    role: "Batter",
    team: "KKR",
    soldTo: null,
    seasonPoints: 0
  },
  {
    id: "t-natarajan-dc",
    name: "T Natarajan",
    basePrice: 20000000,
    tier: "C",
    role: "Bowler",
    team: "DC",
    soldTo: "Thunder XI",
    seasonPoints: 144
  }
];

export const PREVIEW_SESSION = {
  leagueCode: "DEMO26",
  memberId: "member-night-riders"
};

export const PREVIEW_SNAPSHOT = {
  league: {
    id: "league-demo",
    name: "Weekend IPL League",
    code: "DEMO26",
    status: "auction-live",
    ownerMemberId: "member-night-riders"
  },
  config: {
    startingBudget: 1000000000,
    startingBudgetCrore: 100,
    teamSize: 11,
    bidTimerSeconds: 15,
    minBidIncrement: 500000,
    maxTradePriceDifference: 30000000,
    minTeamComposition: {
      wicketkeepers: 1,
      batters: 3,
      bowlers: 3
    }
  },
  me: {
    id: "member-night-riders",
    userName: "Vihan",
    teamName: "Night Riders",
    budgetRemaining: 735000000,
    totalPoints: 700,
    hasPassedCurrentPlayer: false,
    roster: [
      {
        ...players[0],
        purchasePrice: 50000000,
        currentSeasonPoints: 412
      },
      {
        ...players[2],
        purchasePrice: 50000000,
        currentSeasonPoints: 288
      }
    ]
  },
  members: [
    {
      id: "member-night-riders",
      userName: "Vihan",
      teamName: "Night Riders",
      budgetRemaining: 735000000,
      rosterSize: 2,
      totalPoints: 700
    },
    {
      id: "member-thunder",
      userName: "Rohit",
      teamName: "Thunder XI",
      budgetRemaining: 620000000,
      rosterSize: 2,
      totalPoints: 509
    },
    {
      id: "member-boundary",
      userName: "Ashu",
      teamName: "Boundary Hunters",
      budgetRemaining: 650000000,
      rosterSize: 2,
      totalPoints: 511
    }
  ],
  auction: {
    status: "live",
    currentPlayer: {
      id: "suryakumar-yadav-mi",
      name: "Suryakumar Yadav",
      basePrice: 50000000,
      tier: "A",
      role: "Batter",
      team: "MI"
    },
    currentBid: {
      amount: 57500000,
      bidderMemberId: "member-boundary",
      bidderTeamName: "Boundary Hunters"
    },
    expiresAt: new Date(now + 12000).toISOString(),
    soldCount: 6,
    unsoldCount: 2,
    queueSize: 249,
    history: [
      {
        id: "history-1",
        type: "bid",
        teamName: "Boundary Hunters",
        amount: 57500000,
        timestamp: new Date(now - 10000).toISOString()
      }
    ]
  },
  unsoldPlayers: [players[4], players[6]],
  pendingTrades: [
    {
      id: "trade-1",
      proposerMemberId: "member-thunder",
      proposerTeamName: "Thunder XI",
      partnerMemberId: "member-night-riders",
      partnerTeamName: "Night Riders",
      offeredPlayers: [players[1]],
      requestedPlayers: [players[0]]
    }
  ],
  players,
  playersByTier: {
    A: players.filter((player) => player.tier === "A"),
    B: players.filter((player) => player.tier === "B"),
    C: players.filter((player) => player.tier === "C")
  }
};
