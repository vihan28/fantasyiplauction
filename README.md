# Fantasy IPL Auction App

Requested stack:

- Backend: Node.js + Express + Socket.io
- Frontend: React + Vite + Tailwind CSS
- Database: JSON file

## Structure

- `backend/` Express and Socket.io server
- `backend/src/data/db.json` JSON database
- `frontend/` React app powered by Vite
- `shared/constants/dummyPlayers.json` temporary IPL player seed list

Current status:

- Step 1 complete: project structure scaffolded
- Step 2 complete: backend APIs, Socket.io auction flow, trades, market swaps, and JSON persistence
- Step 3 complete: React + Vite + Tailwind frontend screens wired to the backend
- Step 4 complete: backend smoke-tested and frontend production build verified

## Run Locally

One command from project root:

```powershell
cd "C:\Users\ashumi\Desktop\Fantasy Auction App"
npm install
npm run install:all
npm run dev
```

That starts both backend and frontend together.

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend environment:

- Copy `frontend/.env.example` to `.env` if you want a different backend URL
- Default frontend API target is `http://127.0.0.1:5000`

Backend environment:

- `backend/.env` already contains the CricAPI key provided in this thread
- `CRICAPI_SYNC_INTERVAL_MINUTES` controls automatic live sync polling

## Live Scoring

- Live score syncing is restricted to IPL matches only
- Non-IPL matches are rejected by the manual sync path and ignored by automatic syncing
- Fantasy points use the confirmed scoring system for runs, boundaries, sixes, wickets, strike rate, economy, fielding, and Playing XI bonus

## Squad Rules

- Minimum composition per 11-player team:
  - 1 wicketkeeper
  - 3 batters
  - 3 bowlers
- All-rounders are treated as flexible players for batter/bowler minimum validation
- Bids, trades, and market swaps are blocked if they would make a valid final squad impossible

## Verification

- Backend smoke test passed via `backend/smoke-test.js`
- Frontend production build passed via `npm run build` in `frontend/`

## Data Persistence

- Your league data is stored in `backend/src/data/db.json`
- If your PC shuts down, that file stays on disk
- When you restart the backend, leagues, teams, sold players, unsold players, points, and auction state are loaded back from that JSON file
- Auction timers are recreated from saved auction state on server startup

If you want a manual backup, copy:

- `backend/src/data/db.json`

If you ever need to restore data, put your saved copy back at:

- `backend/src/data/db.json`

## Deploy For The Full IPL Season

Recommended hosting:

- Frontend on Render Static Site
- Backend on Render Web Service
- JSON database on a Render Persistent Disk

Why:

- the backend needs to stay online for Socket.IO auctions and live score sync
- the JSON file must survive restarts and deploys
- Render's default filesystem is ephemeral, so the backend should store `db.json` on a persistent disk instead

Prepared files:

- `render.yaml`
- `frontend/.env.production.example`
- `backend/.env.example`

Backend persistence on Render:

- set `DATA_DIR=/opt/render/project/data`
- the app will store the database at `/opt/render/project/data/db.json`
- on first boot, if no file exists there, the app creates one automatically

### Render Deployment Steps

1. Push this project to GitHub.
2. Create a Render account and connect your GitHub account.
3. In Render, create a new Blueprint and select this repository.
4. Render will detect `render.yaml` and propose two services:
   - `fantasy-ipl-auction-backend`
   - `fantasy-ipl-auction-frontend`
5. Before finishing setup, set the backend secret:
   - `CRICAPI_KEY`
6. Keep the backend disk mounted at:
   - `/opt/render/project/data`
7. Deploy the Blueprint.
8. After the backend gets its final public URL, open the frontend service and confirm `VITE_API_BASE_URL` matches the backend URL exactly.
9. Open the frontend public URL and share it with your friends.

### Important Render Note

- `render.yaml` currently uses `https://fantasy-ipl-auction-backend.onrender.com` as the frontend API URL placeholder
- if Render gives your backend a different subdomain, update `VITE_API_BASE_URL` in the frontend service after the first deploy and trigger a redeploy

### Backing Up Season Data

Your live league data on Render will be in:

- `/opt/render/project/data/db.json`

Good habit:

- download a backup copy of `db.json` from the Render disk occasionally
- especially before major app updates

## Current Player Seed

- The current player seed is sourced from the provided Excel squad file and written into `shared/constants/dummyPlayers.json`
- Team names from the spreadsheet are preserved
- Player roles were assigned into `Wicketkeeper`, `Batter`, `Bowler`, and `All-Rounder`
- Duplicate player names in the spreadsheet are kept as separate entries with team-aware IDs
