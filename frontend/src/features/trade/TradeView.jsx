import { useMemo, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { api } from "../../lib/api";

export function TradeView({ snapshot, session, onSnapshot, onError, onSuccess, previewMode = false }) {
  const [partnerMemberId, setPartnerMemberId] = useState("");
  const [offeredPlayerId, setOfferedPlayerId] = useState("");
  const [requestedPlayerId, setRequestedPlayerId] = useState("");
  const [loading, setLoading] = useState(false);

  const otherMembers = snapshot.members.filter((member) => member.id !== snapshot.me.id);
  const partner = useMemo(
    () => snapshot.members.find((member) => member.id === partnerMemberId),
    [snapshot.members, partnerMemberId]
  );
  const partnerRoster = useMemo(() => {
    if (!partner) return [];
    return snapshot.players.filter((player) => player.soldTo === partner.teamName);
  }, [partner, snapshot.players]);

  async function proposeTrade(event) {
    event.preventDefault();
    if (previewMode) {
      onSuccess("Frontend preview only. Live trade requests will work after the backend is connected.");
      return;
    }
    setLoading(true);
    try {
      const next = await api(`/api/leagues/${session.leagueCode}/trades`, {
        method: "POST",
        body: JSON.stringify({
          proposerMemberId: session.memberId,
          partnerMemberId,
          offeredPlayerIds: [offeredPlayerId],
          requestedPlayerIds: [requestedPlayerId]
        })
      });
      onSnapshot(next);
      onSuccess("Trade proposal sent.");
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function respondToTrade(tradeId, decision) {
    if (previewMode) {
      onSuccess("Frontend preview only. Trade actions are disabled in this demo.");
      return;
    }
    setLoading(true);
    try {
      const next = await api(`/api/leagues/${session.leagueCode}/trades/${tradeId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          responderMemberId: session.memberId,
          decision
        })
      });
      onSnapshot(next);
      onSuccess(`Trade ${decision}ed.`);
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
      <Panel title="Propose Trade" subtitle="Equal players only, max price gap 3 Cr">
        <form className="grid gap-4" onSubmit={proposeTrade}>
          <select
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            value={partnerMemberId}
            onChange={(event) => setPartnerMemberId(event.target.value)}
          >
            <option value="">Choose trade partner</option>
            {otherMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.teamName}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            value={offeredPlayerId}
            onChange={(event) => setOfferedPlayerId(event.target.value)}
          >
            <option value="">Your player</option>
            {snapshot.me.roster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            value={requestedPlayerId}
            onChange={(event) => setRequestedPlayerId(event.target.value)}
          >
            <option value="">Requested player</option>
            {partnerRoster.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !partnerMemberId || !offeredPlayerId || !requestedPlayerId}
            className="rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {previewMode ? "Preview only" : "Send trade"}
          </button>
        </form>
      </Panel>

      <Panel title="Pending Trades" subtitle="Only the invited partner can accept">
        <div className="grid gap-3">
          {snapshot.pendingTrades.length ? (
            snapshot.pendingTrades.map((trade) => {
              const isPartner = trade.partnerMemberId === session.memberId;
              return (
                <div key={trade.id} className="rounded-3xl border border-stone-200 bg-white/70 p-4">
                  <p className="font-semibold text-slate-900">
                    {trade.proposerTeamName} ⇄ {trade.partnerTeamName}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {trade.offeredPlayers.map((player) => player.name).join(", ")} for{" "}
                    {trade.requestedPlayers.map((player) => player.name).join(", ")}
                  </p>
                  {isPartner ? (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => respondToTrade(trade.id, "accept")}
                        className="rounded-2xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => respondToTrade(trade.id, "reject")}
                        className="rounded-2xl bg-stone-200 px-4 py-2 text-slate-900 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No pending trades.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
