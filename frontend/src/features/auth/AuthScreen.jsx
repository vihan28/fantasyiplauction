import { useState } from "react";
import { Panel } from "../../components/ui/Panel";

export function AuthScreen({ onCreate, onJoin, loading }) {
  const [createForm, setCreateForm] = useState({
    leagueName: "",
    userName: "",
    teamName: ""
  });
  const [joinForm, setJoinForm] = useState({
    leagueCode: "",
    userName: "",
    teamName: ""
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="Create a private league"
        subtitle="Start a room for friends with a 100 Cr budget and 11-player squads."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(createForm);
          }}
        >
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
            placeholder="League name"
            value={createForm.leagueName}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, leagueName: event.target.value }))
            }
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
            placeholder="Your name"
            value={createForm.userName}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, userName: event.target.value }))
            }
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
            placeholder="Team name"
            value={createForm.teamName}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, teamName: event.target.value }))
            }
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-orange-500 px-4 py-3 font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            Create league
          </button>
        </form>
      </Panel>

      <Panel
        title="Join with invite code"
        subtitle="Enter the league code and bring your own team name."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(joinForm);
          }}
        >
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 uppercase outline-none"
            placeholder="Invite code"
            value={joinForm.leagueCode}
            onChange={(event) =>
              setJoinForm((current) => ({ ...current, leagueCode: event.target.value.toUpperCase() }))
            }
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
            placeholder="Your name"
            value={joinForm.userName}
            onChange={(event) =>
              setJoinForm((current) => ({ ...current, userName: event.target.value }))
            }
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none"
            placeholder="Team name"
            value={joinForm.teamName}
            onChange={(event) =>
              setJoinForm((current) => ({ ...current, teamName: event.target.value }))
            }
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            Join league
          </button>
        </form>
      </Panel>
    </div>
  );
}
