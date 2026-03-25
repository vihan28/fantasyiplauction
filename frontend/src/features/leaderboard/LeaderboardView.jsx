import { Panel } from "../../components/ui/Panel";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function LeaderboardView({ snapshot }) {
  const rows = [...snapshot.members].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Panel title="Leaderboard" subtitle="Total points from live IPL-only scoring">
      <div className="grid gap-3">
        {rows.map((member, index) => (
          <div
            key={member.id}
            className={`flex items-center justify-between rounded-3xl border p-4 ${
              index === 0 ? "border-orange-300 bg-orange-50" : "border-stone-200 bg-white/70"
            }`}
          >
            <div>
              <p className="font-semibold text-slate-900">
                #{index + 1} {member.teamName}
              </p>
              <p className="text-sm text-slate-500">
                {member.userName} • {member.rosterSize}/{snapshot.config.teamSize} players
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{member.totalPoints} pts</p>
              <p className="text-sm text-slate-500">{formatCurrency(member.budgetRemaining)}</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
