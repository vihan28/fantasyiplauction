import { Panel } from "../../components/ui/Panel";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function TeamView({ snapshot }) {
  const { me } = snapshot;

  return (
    <Panel title={`${me.teamName} Squad`} subtitle={`Budget left: ${formatCurrency(me.budgetRemaining)}`}>
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
