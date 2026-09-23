# Soundtrack Platform

One platform, two products, one shared taste graph. Full build spec: [soundtrack-platform-spec.md](soundtrack-platform-spec.md).

- **Personal app** (`/me`) — live ambient soundtrack from mic/camera/GPS + taste profile.
- **Venue platform** (`/venues`) — QR-based room, live guest queue with vote/bid, AI DJ.

## Run locally

### Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY for real DJ/mood output; works without it (fallback logic)
uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api and /ws to :8000
```

Open `http://localhost:5173`. Register an account, try `/me` for the personal app, or create a venue under
`/venues` and scan the room's QR code (or open its join URL) in another tab/device to try the guest flow.

## What's real vs. simulated

See spec §3 for the full table. In short: auth, venues/rooms, QR join, live queue + WebSocket broadcast, voting,
bidding (real ranking logic, fake payment), taste blending, mic energy, ambient audio generation, GPS, weather, and
Deezer preview playback are all real. Spotify/Apple Music OAuth and camera-based crowd CV are simulated with
functions shaped like their real counterparts (`connect_music_library`, `analyze_crowd` in
`backend/app/services/`), so swapping in the real integration later is a function-body change, not a rearchitecture.

The DJ engine (`POST /api/rooms/{room_id}/dj/suggest`) and the personal app's mood fusion (`POST /api/me/mood`) are
real Claude (Sonnet, vision-capable) calls in `backend/app/services/llm.py`. Both fall back gracefully (highest-voted
track / mid-energy default) if `ANTHROPIC_API_KEY` is unset or the call fails — the demo never crashes on a missing
key.

## Deployment (single EC2 instance)

See spec §10. Summary: `uvicorn` behind `gunicorn` + systemd, nginx reverse-proxying `/api` and `/ws` to the FastAPI
process and serving the built frontend (`npm run build` → `frontend/dist/`) as static files. HTTPS is required for
guest camera/mic access (`getUserMedia` is blocked on plain HTTP except localhost) — use certbot. Set `SECRET_KEY`
and `ANTHROPIC_API_KEY` as environment variables, never committed.
