export function StatCard({ label, value, tone = "default" }) {
  const toneMap = {
    default: "bg-white/70 text-slate-900",
    accent: "bg-orange-500 text-white",
    teal: "bg-teal-700 text-white"
  };

  return (
    <div className={`rounded-3xl border border-white/40 p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-[0.2em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
