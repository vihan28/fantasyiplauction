const TABS = [
  { id: "auction", label: "Auction" },
  { id: "team", label: "Team" },
  { id: "market", label: "Market" },
  { id: "trade", label: "Trade" },
  { id: "leaderboard", label: "Leaderboard" }
];

export function TabBar({ activeTab, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[2rem] border border-white/50 bg-white/60 p-2 shadow-lg sm:grid-cols-5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
            activeTab === tab.id
              ? "bg-slate-900 text-white shadow-lg"
              : "bg-transparent text-slate-600 hover:bg-white/70"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
