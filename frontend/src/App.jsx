import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, PREVIEW_MODE } from "./lib/config";
import { api } from "./lib/api";
import { PREVIEW_SESSION, PREVIEW_SNAPSHOT } from "./lib/preview-data";
import { clearSession, loadSession, saveSession } from "./lib/storage";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AuctionView } from "./features/auction/AuctionView";
import { TeamView } from "./features/team/TeamView";
import { MarketView } from "./features/market/MarketView";
import { TradeView } from "./features/trade/TradeView";
import { LeaderboardView } from "./features/leaderboard/LeaderboardView";
import { TabBar } from "./components/layout/TabBar";

function useCountdown(expiresAt) {
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setCountdown(0);
      return undefined;
    }

    const tick = () => {
      setCountdown(Math.max(Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000), 0));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return countdown;
}

function previewMessage() {
  return "Frontend preview only. Connect the backend later to create leagues and run the live auction.";
}

export default function App() {
  const [session, setSession] = useState(() => (PREVIEW_MODE ? PREVIEW_SESSION : loadSession()));
  const [snapshot, setSnapshot] = useState(() => (PREVIEW_MODE ? PREVIEW_SNAPSHOT : null));
  const [activeTab, setActiveTab] = useState("auction");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(PREVIEW_MODE ? previewMessage() : "");
  const [error, setError] = useState("");
  const [bidAmount, setBidAmount] = useState("");

  const countdown = useCountdown(snapshot?.auction?.expiresAt);

  useEffect(() => {
    if (PREVIEW_MODE || !session) return undefined;

    const socket = io(API_BASE_URL, { transports: ["websocket"] });
    socket.emit("league:join", {
      leagueCode: session.leagueCode,
      memberId: session.memberId
    });

    socket.on("league:update", () => {
      api(`/api/leagues/${session.leagueCode}?memberId=${session.memberId}`)
        .then(setSnapshot)
        .catch((err) => setError(err.message));
    });

    socket.on("league:personal", setSnapshot);
    socket.on("auction:pass-confirmed", () => {
      setMessage("Pass registered privately.");
      setError("");
    });

    return () => socket.close();
  }, [session]);

  useEffect(() => {
    if (PREVIEW_MODE || !session) return;

    api(`/api/leagues/${session.leagueCode}?memberId=${session.memberId}`)
      .then(setSnapshot)
      .catch((err) => {
        setError(err.message);
        clearSession();
        setSession(null);
      });
  }, [session]);

  useEffect(() => {
    if (!snapshot?.auction) return;
    setBidAmount(String(snapshot.auction.currentBid.amount || ""));
  }, [snapshot?.auction?.currentPlayer?.id, snapshot?.auction?.currentBid?.amount]);

  const title = useMemo(() => {
    if (!snapshot?.league) return "Fantasy IPL Auction";
    return `${snapshot.league.name} | ${snapshot.league.code}`;
  }, [snapshot]);

  async function handleCreate(values) {
    if (PREVIEW_MODE) {
      setMessage(previewMessage());
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await api("/api/leagues", {
        method: "POST",
        body: JSON.stringify(values)
      });
      saveSession(payload.credentials);
      setSession(payload.credentials);
      setSnapshot(payload.snapshot);
      setMessage(`League created. Share code ${payload.credentials.leagueCode}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(values) {
    if (PREVIEW_MODE) {
      setMessage(previewMessage());
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await api(`/api/leagues/${values.leagueCode}/join`, {
        method: "POST",
        body: JSON.stringify(values)
      });
      saveSession(payload.credentials);
      setSession(payload.credentials);
      setSnapshot(payload.snapshot);
      setMessage(`Joined ${payload.snapshot.league.name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartAuction() {
    if (PREVIEW_MODE) {
      setMessage(previewMessage());
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      const payload = await api(`/api/leagues/${session.leagueCode}/auction/start`, {
        method: "POST",
        body: JSON.stringify({ memberId: session.memberId })
      });
      setSnapshot(payload);
      setMessage("Auction started.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteLeague() {
    if (PREVIEW_MODE) {
      setMessage(previewMessage());
      return;
    }

    const confirmed = window.confirm(
      `Delete league ${snapshot.league.name} (${snapshot.league.code})? This cannot be undone.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");
    try {
      await api(`/api/leagues/${session.leagueCode}?memberId=${session.memberId}`, {
        method: "DELETE"
      });
      clearSession();
      setSnapshot(null);
      setSession(null);
      setMessage("League deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function emitAuctionEvent(event, payload, successMessage) {
    if (PREVIEW_MODE) {
      setMessage(previewMessage());
      return;
    }

    setActionLoading(true);
    setError("");

    const socket = io(API_BASE_URL, { transports: ["websocket"], autoConnect: true });

    try {
      await new Promise((resolve) => socket.on("connect", resolve));
      await new Promise((resolve, reject) => {
        socket.emit(event, payload, (result) => {
          if (!result?.ok) {
            reject(new Error(result?.message || "Auction action failed"));
            return;
          }
          resolve();
        });
      });

      const next = await api(`/api/leagues/${session.leagueCode}?memberId=${session.memberId}`);
      setSnapshot(next);
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      socket.close();
      setActionLoading(false);
    }
  }

  if (!session || !snapshot) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.14),_transparent_30%),linear-gradient(180deg,_#f8fafc,_#f5f5f4)] px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-[2.5rem] border border-white/50 bg-white/70 p-8 shadow-2xl shadow-orange-100/50 backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-orange-700">Private Fantasy Cricket</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight text-slate-900">
              Fantasy IPL Auction
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600">
              Create a league, run the auction live with friends, trade smart, and let IPL-only CricAPI scoring settle the table.
            </p>
          </div>
          {error ? <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
          {message ? <div className="mb-4 rounded-2xl bg-teal-50 px-4 py-3 text-teal-700">{message}</div> : null}
          <AuthScreen onCreate={handleCreate} onJoin={handleJoin} loading={loading} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(20,184,166,0.12),_transparent_25%),radial-gradient(circle_at_top_left,_rgba(249,115,22,0.15),_transparent_35%),linear-gradient(180deg,_#f8fafc,_#f5f5f4)] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[2.5rem] border border-white/50 bg-white/70 p-6 shadow-2xl shadow-stone-200/70 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-orange-700">
                {PREVIEW_MODE ? "Frontend Preview" : "Live IPL Only"}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {snapshot.me.teamName} | {snapshot.me.userName} | {snapshot.league.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(snapshot.league.code);
                  setMessage("Invite code copied.");
                  setError("");
                }}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow"
              >
                Copy Code
              </button>
              {!PREVIEW_MODE && snapshot.league.ownerMemberId === session.memberId ? (
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={actionLoading}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow disabled:opacity-50"
                >
                  Delete League
                </button>
              ) : null}
              {!PREVIEW_MODE ? (
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    setSnapshot(null);
                    setSession(null);
                  }}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow"
                >
                  Leave Session
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-2xl bg-teal-50 px-4 py-3 text-teal-700">{message}</div> : null}

        <div className="mb-6">
          <TabBar activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {activeTab === "auction" ? (
          <AuctionView
            snapshot={snapshot}
            countdown={countdown}
            bidAmount={bidAmount}
            setBidAmount={setBidAmount}
            onBid={() =>
              emitAuctionEvent(
                "auction:bid",
                {
                  leagueCode: session.leagueCode,
                  memberId: session.memberId,
                  amount: Number(bidAmount)
                },
                "Bid placed."
              )
            }
            onPass={() =>
              emitAuctionEvent(
                "auction:pass",
                {
                  leagueCode: session.leagueCode,
                  memberId: session.memberId
                },
                "Pass submitted."
              )
            }
            onStartAuction={handleStartAuction}
            actionLoading={actionLoading}
          />
        ) : null}
        {activeTab === "team" ? <TeamView snapshot={snapshot} /> : null}
        {activeTab === "market" ? (
          <MarketView
            snapshot={snapshot}
            session={session}
            onSnapshot={setSnapshot}
            onError={setError}
            onSuccess={setMessage}
            previewMode={PREVIEW_MODE}
          />
        ) : null}
        {activeTab === "trade" ? (
          <TradeView
            snapshot={snapshot}
            session={session}
            onSnapshot={setSnapshot}
            onError={setError}
            onSuccess={setMessage}
            previewMode={PREVIEW_MODE}
          />
        ) : null}
        {activeTab === "leaderboard" ? <LeaderboardView snapshot={snapshot} /> : null}
      </div>
    </main>
  );
}
