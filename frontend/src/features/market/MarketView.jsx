import { useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { api } from "../../lib/api";

export function MarketView({ snapshot, session, onSnapshot, onError, onSuccess }) {
  const [outgoingPlayerId, setOutgoingPlayerId] = useState("");
  const [incomingPlayerId, setIncomingPlayerId] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitSwap(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const next = await api(`/api/leagues/${session.leagueCode}/market/swaps`, {
        method: "POST",
        body: JSON.stringify({
          memberId: session.memberId,
          outgoingPlayerId,
          incomingPlayerId
        })
      });
      onSnapshot(next);
      onSuccess("Market swap completed.");
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
      <Panel title="Unsold Players Market" subtitle="1-for-1 swap, price gap up to 3 Cr">
        <div className="grid gap-3 md:grid-cols-2">
          {snapshot.unsoldPlayers.length ? (
            snapshot.unsoldPlayers.map((player) => (
              <div key={player.id} className="rounded-3xl border border-stone-200 bg-white/70 p-4">
                <p className="font-semibold text-slate-900">{player.name}</p>
                <p className="text-sm text-slate-500">{player.team} • {player.role}</p>
                <p className="mt-3 text-sm text-slate-600">Base price: ₹{player.basePrice.toLocaleString("en-IN")}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No unsold players available yet.</p>
          )}
        </div>
      </Panel>

      <Panel title="Swap From Your Team" subtitle="Outgoing player must be trade-ready">
        <form className="grid gap-4" onSubmit={submitSwap}>
          <select
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            value={outgoingPlayerId}
            onChange={(event) => setOutgoingPlayerId(event.target.value)}
          >
            <option value="">Choose outgoing player</option>
            {snapshot.me.roster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            value={incomingPlayerId}
            onChange={(event) => setIncomingPlayerId(event.target.value)}
          >
            <option value="">Choose incoming player</option>
            {snapshot.unsoldPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !outgoingPlayerId || !incomingPlayerId}
            className="rounded-2xl bg-teal-700 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            Confirm swap
          </button>
        </form>
      </Panel>
    </div>
  );
}
