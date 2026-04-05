import { Panel } from "../../components/ui/Panel";

function formatCurrency(value) {
  return `Rs.${Number(value || 0).toLocaleString("en-IN")}`;
}

function getRoleCounts(roster) {
  return roster.reduce(
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

export function TeamView({ snapshot }) {
  const { me, config } = snapshot;
  const counts = getRoleCounts(me.roster);
  const minimums = config.minTeamComposition || {
    wicketkeepers: 1,
    batters: 3,
    bowlers: 3
  };

  return (
    <Panel title={`${me.teamName} Squad`} subtitle={`Budget left: ${formatCurrency(me.budgetRemaining)}`}>
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Team Rules</p>
          <p className="mt-2 text-sm text-slate-700">{config.teamSize} total players required</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Wicketkeepers</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {counts.wicketkeepers}/{minimums.wicketkeepers} minimum
          </p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Batters</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {counts.batters}/{minimums.batters} minimum
          </p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bowlers</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {counts.bowlers}/{minimums.bowlers} minimum
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {me.roster.length ? (
          me.roster.map((player) => (
            <div key={player.id} className="rounded-3xl border border-stone-200 bg-white/70 p-4">
              <p className="font-semibold text-slate-900">{player.name}</p>
              <p className="text-sm text-slate-500">{player.team} • {player.role}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span>Buy: {formatCurrency(player.purchasePrice)}</span>
                <span>{player.currentSeasonPoints} pts</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No players yet. Win players in the auction first.</p>
        )}
      </div>
    </Panel>
  );
}
