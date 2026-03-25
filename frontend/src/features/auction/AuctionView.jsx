import { Panel } from "../../components/ui/Panel";
import { StatCard } from "../../components/ui/StatCard";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function AuctionView({
  snapshot,
  countdown,
  bidAmount,
  setBidAmount,
  onBid,
  onPass,
  onStartAuction,
  actionLoading
}) {
  const { auction, me, league, playersByTier = {} } = snapshot;
  const currentPlayer = auction.currentPlayer;
  const canStart = league.ownerMemberId === me.id && auction.status === "pending" && snapshot.members.length >= 2;
  const leading = auction.currentBid.bidderMemberId === me.id;
  const tierEntries = Object.entries(playersByTier);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Invite Code" value={league.code} tone="accent" />
        <StatCard label="Budget Left" value={formatCurrency(me.budgetRemaining)} />
        <StatCard label="Squad Size" value={`${me.roster.length}/${snapshot.config.teamSize}`} />
        <StatCard label="Timer" value={auction.status === "live" ? `${countdown}s` : "--"} tone="teal" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Panel
          title={auction.status === "live" ? currentPlayer?.name || "Waiting..." : "Auction Lobby"}
          subtitle={
            auction.status === "live"
              ? `${currentPlayer?.team || ""} • ${currentPlayer?.role || ""} • Tier ${currentPlayer?.tier || "-"}`
              : "Start the auction when everyone has joined."
          }
          actions={
            canStart ? (
              <button
                type="button"
                onClick={onStartAuction}
                disabled={actionLoading}
                className="rounded-2xl bg-orange-500 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                Start Auction
              </button>
            ) : null
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Current Bid" value={formatCurrency(auction.currentBid.amount)} />
              <StatCard
                label="Highest Bidder"
                value={auction.currentBid.bidderTeamName || "No bids"}
                tone={leading ? "accent" : "default"}
              />
              <StatCard label="Unsold Pool" value={auction.unsoldCount} />
            </div>

            <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bid Controls</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  type="number"
                  min={auction.currentBid.amount || 0}
                  value={bidAmount}
                  onChange={(event) => setBidAmount(event.target.value)}
                  className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
                  placeholder="Enter bid amount"
                  disabled={auction.status !== "live" || me.hasPassedCurrentPlayer}
                />
                <button
                  type="button"
                  onClick={onBid}
                  disabled={auction.status !== "live" || me.hasPassedCurrentPlayer || actionLoading}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  Place bid
                </button>
                <button
                  type="button"
                  onClick={onPass}
                  disabled={auction.status !== "live" || me.hasPassedCurrentPlayer || actionLoading}
                  className="rounded-2xl bg-stone-200 px-5 py-3 font-medium text-slate-900 disabled:opacity-50"
                >
                  Pass
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Once you pass, you cannot bid again for this player. Auction ends automatically when all teams reach 11 players.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Teams" subtitle="Live budgets and squad progress">
          <div className="grid gap-3">
            {snapshot.members.map((member) => (
              <div
                key={member.id}
                className={`rounded-3xl border p-4 ${
                  auction.currentBid.bidderMemberId === member.id
                    ? "border-orange-300 bg-orange-50"
                    : "border-stone-200 bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{member.teamName}</p>
                    <p className="text-sm text-slate-500">{member.userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatCurrency(member.budgetRemaining)}</p>
                    <p className="text-sm text-slate-500">
                      {member.rosterSize}/{snapshot.config.teamSize}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Categorized Player Pool"
        subtitle="Auction nomination is tier-first, then random within the current tier"
      >
        <div className="grid gap-6">
          {tierEntries.map(([tier, players]) => (
            <div key={tier} className="grid gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Tier {tier}</h3>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                  {players.length} players
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`rounded-3xl border p-4 ${
                      player.soldTo ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{player.name}</p>
                        <p className="text-sm text-slate-500">{player.team} • {player.role}</p>
                      </div>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                        Tier {player.tier}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-slate-500">{formatCurrency(player.basePrice)}</span>
                      <span className={player.soldTo ? "font-medium text-teal-700" : "text-slate-400"}>
                        {player.soldTo || "Available"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
