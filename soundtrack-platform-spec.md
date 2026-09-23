# Soundtrack Platform — Build Specification

**Purpose of this document:** hand this to Claude (or any engineer) to build the app end-to-end, deployable on a single EC2 instance. It defines scope, architecture, data model, API surface, frontend pages, and — critically — which parts must be real vs simulated for a hackathon-speed build, with a clear contract for upgrading fakes to real integrations later.

---

## 1. Product overview

One platform, two products, one shared account/taste-profile system:

1. **Personal app** — a user's phone (mic, camera, GPS) plus their music taste profile generates a live "soundtrack of the moment": an ambient audio mix, a visualizer, and a shareable card. Works standalone (driving, walking, chilling at home).

2. **Venue platform (B2B)** — restaurants/pubs register, create a "room" (e.g. Friday night floor), get a QR code for that room. Guests scan the QR to join: they can optionally connect their music taste (or log into an existing personal-app account, auto-pulling their saved profile). The venue's room reads the crowd (camera + mic) and blends guest tastes into a live-updating queue. Guests can vote tracks up, or optionally **bid** to boost a track's position instead of asking the DJ directly.

The unifying idea: **one taste graph, two contexts.** A personal-app user who already has a taste profile gets it applied automatically the moment they scan a venue QR and log in — no re-entry.

**Visual direction:** moody, high-contrast, club-poster aesthetic — dark backgrounds, bold type, punchy accent color tied to live energy/mood, not a generic light-mode SaaS dashboard look.

---

## 2. Tech stack

- **Backend:** FastAPI (Python 3.11+), SQLAlchemy ORM, SQLite for MVP (swap to Postgres for anything beyond a single EC2 box / demo)
- **Auth:** JWT (python-jose), bcrypt password hashing (passlib)
- **Realtime:** FastAPI WebSockets for live queue + crowd updates
- **Frontend:** React (Vite), plain fetch/axios for API calls, no heavy state library needed at this scope (React context is enough)
- **QR codes:** `qrcode` Python package, generated server-side as base64 PNG
- **Audio (personal app only):** Web Audio API (`AnalyserNode` for mic energy, oscillators/gain nodes for ambient generation) — no backend audio processing needed, all client-side. **Mobile note:** both this generator and the Deezer `<audio>` preview playback must be first triggered by a user tap/click — mobile browsers block autoplay before a user gesture, so the personal dashboard and guest queue UI need an explicit "start"/"play" button rather than auto-playing on load.
- **Deployment target:** single EC2 instance running both the FastAPI app (via `uvicorn`/`gunicorn`, reverse-proxied by nginx) and the built React static files (served by nginx). SQLite file lives on the instance's EBS volume — fine for a demo, **not** for multi-instance scaling.

---

## 3. What's real vs simulated

Every simulated piece must return data **shaped exactly like the real integration would**, so replacing the fake is a function-body swap, not a rearchitecture. This contract must be preserved by whoever builds this.

| Component | Status | Notes |
|---|---|---|
| Auth (register/login/JWT) | **Real** | Standard, no reason to fake |
| Venue / Room CRUD | **Real** | Plain DB operations |
| QR code generation + guest join flow | **Real** | Actual scannable QR linking to a real join URL |
| Live queue (add/vote) | **Real** | Stored and ranked in DB, broadcast over WebSocket |
| Bidding | **Real logic, fake payment** | Bid amount is stored and affects ranking; no money actually moves. Stub a `process_payment(amount)` function that always succeeds, clearly marked `# TODO: real payment processor (Stripe)` |
| Genre/taste blending across guests | **Real** | Simple frequency counting across connected guest profiles — genuinely useful without any ML |
| Mic energy (personal app) | **Real** | Browser `AnalyserNode`, trivial and works today |
| Ambient audio generation (personal app) | **Real** | Web Audio oscillators/filters driven by mood params |
| Spotify/Apple Music "connect your library" | **Simulated** | Returns a canned but plausible top-artists/genres list. Real OAuth needs app review + secrets not available at hackathon speed. Build the function as `connect_music_library(user_id) -> {top_artists, top_genres}` so a real OAuth flow can replace the body later without touching callers |
| Camera-based crowd analysis (families / young adults / want-to-dance / headcount) | **Simulated** | Returns randomized but structurally realistic JSON matching what a real CV pipeline (e.g. a lightweight pose/age-estimation model) would output. Build as `analyze_crowd(room_id) -> CrowdSnapshot` with a fixed schema |
| DJ's next-track reasoning | **Real (LLM call)** | This is just a well-constructed LLM prompt combining taste blend + crowd snapshot + recent queue history — genuinely buildable and the most impressive real part of the demo. See §7 |
| Personal app's mood/context fusion | **Real (LLM call)** | Combines mic energy + camera mood read + time/location/weather + taste history into structured mood params (valence/energy/tempo). See §7 |
| GPS / location context (personal app) | **Real** | Browser geolocation API |
| Weather context (personal app) | **Real** | Free weather API call (e.g. Open-Meteo, no key required) |
| Track playback (venue queue) | **Real** | Deezer's public catalog API (`api.deezer.com`) requires **no authentication at all** and returns a `preview_url` — a real, playable 30-second MP3 — for most tracks. Use this to search by title/artist and get a playable URL for the queue. See §7a |

---

## 4. Data model

```
User
  id (uuid, pk)
  email (unique)
  hashed_password
  display_name
  top_artists (json list)
  top_genres (json list)
  music_connected (bool)
  created_at

Venue
  id (uuid, pk)
  owner_id (fk -> User)
  name
  address
  created_at

Room
  id (uuid, pk)
  venue_id (fk -> Venue)
  name
  is_active (bool)
  crowd_snapshot (json)   # latest simulated crowd read
  created_at

GuestProfile
  id (uuid, pk)
  room_id (fk -> Room)
  user_id (fk -> User, nullable)   # set if guest logged in
  display_name
  top_artists (json list)
  top_genres (json list)
  music_connected (bool)
  joined_at

QueueTrack
  id (uuid, pk)
  room_id (fk -> Room)
  title
  artist
  requested_by
  vote_count (int)
  bid_amount (float)
  played (bool)
  created_at
```

**Ranking rule (default, documented as an assumption — confirm before building):**
Queue order = `vote_count + (bid_amount * BID_WEIGHT)`, where `BID_WEIGHT` is a tunable constant (e.g. 2.0) — bidding **adds weight** rather than **guaranteeing an outright jump to the top**, so it stays influence-not-pay-to-win. This should be a named constant, easy to change during the demo.

---

## 5. API surface

All endpoints under `/api`. JWT bearer auth required except where noted `(public)`.

### Auth
- `POST /api/auth/register` — create account, returns JWT
- `POST /api/auth/login` — returns JWT
- `GET /api/auth/me` — current user profile
- `POST /api/auth/connect-music` — (simulated) attaches canned top artists/genres to the logged-in user

### Venues
- `POST /api/venues` — create venue (owner = current user)
- `GET /api/venues` — list venues owned by current user
- `GET /api/venues/{id}` `(public)` — venue details

### Rooms
- `POST /api/venues/{venue_id}/rooms` — create room
- `GET /api/venues/{venue_id}/rooms` — list rooms for a venue
- `GET /api/rooms/{room_id}` `(public)` — room details
- `GET /api/rooms/{room_id}/qr` `(public)` — returns `{join_url, qr_png_base64}`
- `POST /api/rooms/{room_id}/crowd-scan` `(public)` — (simulated) refreshes and returns the room's crowd snapshot — public for demo simplicity, no reason to gate a fake read

### Guests
- `POST /api/rooms/{room_id}/join` `(public)` — join a room as a guest; body `{display_name, connect_music: bool}`; if the requester is also logged in as a User, link `user_id` and pull their **real saved profile** instead of a fresh fake one
- `GET /api/rooms/{room_id}/guests` `(public)` — list guests currently in the room
- `GET /api/rooms/{room_id}/taste-blend` `(public)` — ranked genre blend across connected guests

### Queue
- `POST /api/rooms/{room_id}/queue` `(public)` — request a track
- `POST /api/rooms/{room_id}/queue/vote` `(public)` — upvote a track
- `POST /api/rooms/{room_id}/queue/bid` `(public)` — attach a bid amount to a track (simulated payment, real ranking effect)
- `GET /api/rooms/{room_id}/queue` `(public)` — current ranked queue
- `WS /api/rooms/{room_id}/live` — WebSocket; broadcasts queue + crowd snapshot changes to all connected clients (dashboard and guest views both subscribe)

### DJ engine
- `POST /api/rooms/{room_id}/dj/suggest` — combines taste blend + crowd snapshot + current queue into one LLM call, returns a suggested next track + short reasoning string (this is the "AI DJ" moment — make sure the reasoning string is shown in the venue dashboard UI, it's the most demo-worthy output)
- `POST /api/rooms/{room_id}/queue/{track_id}/played` `(public)` — marks a track as played (e.g. called by the venue dashboard when a track finishes or is skipped); used to advance the queue and feeds the "last 5 played tracks" input to the DJ engine (§7)

### Personal app
- `POST /api/me/mood` `(public — no login required, works for anonymous personal-app use)` — combines mic energy reading, camera snapshot frame (vision LLM call), GPS, and weather into structured mood params `{valence, energy, tempo}` that drive the Web Audio ambient generator (see §8, point 2)

---

## 6. Frontend pages

- **Landing (`/`)** — explains both products (personal + venue), links to register/login
- **Register / Login (`/register`, `/login`)**
- **Personal dashboard (`/me`)** — connect music (simulated), grant mic/cam/GPS permissions, live mood readout, generated ambient audio + canvas visualizer, shareable card generator
- **Venue owner dashboard (`/venues/:venueId`)** — create rooms, per-room: QR code display, live crowd snapshot (families/young-adults/dancers/headcount), live queue with vote/bid counts, DJ suggestion + reasoning panel
- **Guest join (`/join/:roomId`)** `(public, no login required)` — landing after QR scan: "let the DJ read your vibe tonight?" → optional connect-music button (simulated) or log in to pull a saved profile → see live queue → request/vote/bid

---

## 7. The "DJ engine" prompt (core intelligence)

This is a single well-built LLM call, not a trained model — document it explicitly so whoever builds this doesn't over-engineer it:

**Inputs:** blended top genres across connected guests (with counts), crowd snapshot (headcount, group-type percentages, energy level), last 5 played tracks (avoid repeats), current top-of-queue candidates.

**Output (structured JSON):** `{suggested_track, suggested_artist, reasoning, target_energy, target_valence}`

**Prompt shape:** "You are a DJ reading the room. Given this taste blend and this crowd reading, suggest the next track and explain your reasoning in one sentence a venue dashboard could display to staff."

Keep this as one function, easily testable in isolation with mock inputs before wiring it to the live data.

---

## 7a. Real track playback via Deezer

Deezer exposes a free, public, unauthenticated REST API at `https://api.deezer.com`. No API key, no OAuth, no account needed — this is a genuine and reliable way to get real playable audio into the demo.

**Endpoint to use:** `GET https://api.deezer.com/search?q={title} {artist}`

Returns JSON including, per track: `title`, `artist.name`, `album.cover_medium`, `duration`, and **`preview_url`** — a direct link to a 30-second MP3 that plays in any `<audio>` tag with zero extra setup.

**Integration point:** when a guest requests a track (`POST /api/rooms/{room_id}/queue`), the backend should call Deezer search with the title/artist, store the returned `preview_url` and `cover_medium` on the `QueueTrack` row, and the frontend queue UI plays it directly with a standard HTML `<audio src="{preview_url}">` element — no streaming infrastructure needed.

Add two fields to `QueueTrack`: `preview_url` (string, nullable) and `cover_url` (string, nullable). If Deezer has no match for a requested title, leave both null and show the track as "no preview available" in the UI rather than failing the request.

This single integration is what turns the venue demo from "a list of song names" into "an app that actually plays music that changes as the room's vibe changes" — worth prioritizing early in the build.

---

## 8. LLM integration

Two components need real LLM calls (see §3 and §7a is unrelated — playback needs no LLM). Both should call the Anthropic API (`api.anthropic.com/v1/messages`) using a Claude Sonnet model (e.g. `claude-sonnet-4-5`) — the personal app's fusion call sends an image (camera snapshot frame) alongside text, so it must use a vision-capable model; Sonnet models support this.

1. **DJ engine** (`POST /api/rooms/{room_id}/dj/suggest`) — inputs: blended taste genres, crowd snapshot, recent queue history. Output: structured JSON with `suggested_track`, `suggested_artist`, `reasoning`, `target_energy`, `target_valence`. After getting a suggestion, call the Deezer search (§7a) to attach a real, playable preview.
2. **Personal app fusion layer** — inputs: mic energy reading, camera mood read (send a snapshot frame + ask the model to describe mood — a vision-capable call), time/location/weather, saved taste history. Output: structured JSON mood params that drive the Web Audio ambient generator.

**Setup on EC2:**
- Store the Anthropic API key as an environment variable on the instance, e.g. `ANTHROPIC_API_KEY`, loaded via `python-dotenv` or the OS environment — **never commit it to the repo, never hardcode it in source**.
- Both LLM-calling functions should read the key from `os.environ["ANTHROPIC_API_KEY"]` at call time.
- If the key is missing or a call fails, both endpoints should fall back gracefully (e.g. pick the highest-voted queued track with no reasoning text, or a default mid-energy mood) rather than crashing the demo.
- Ask for structured JSON output directly from the model (system prompt: "respond only with JSON, no preamble") to avoid needing a separate parsing/retry step.

---

## 9. Assumptions to confirm (defaults chosen, flag as changeable)

1. **Bidding model:** bids add weight to ranking rather than guaranteeing top position (see §4 ranking rule). Confirm `BID_WEIGHT` constant is easy to tune live during the demo.
2. **Anonymous guests always allowed:** a guest never needs to log in to join a room or connect (fake) music — this keeps the demo resilient to flaky venue wifi/login friction. Logging in is only needed to pull a *real, previously-saved* profile.
3. **Demo mode for crowd scanning:** since real camera CV isn't built, include a "demo mode" toggle on the venue dashboard that cycles the simulated crowd snapshot through a few preset scenarios (quiet early evening → filling up → dance-floor energy) on a timer, so the demo has a visible narrative arc without needing a real camera feed live on stage.

---

## 10. EC2 deployment notes

- Single instance is fine for a demo: run `uvicorn app.main:app` behind `gunicorn` with a process manager (systemd or `pm2`), reverse-proxied by nginx on port 80/443.
- Serve the built React app (`npm run build`) as static files via the same nginx, proxying `/api` and `/ws` paths to the FastAPI process.
- Open only ports 80/443 (and 22 for SSH) in the security group.
- Set `SECRET_KEY` (JWT signing) and `ANTHROPIC_API_KEY` (LLM calls, §8) via environment variables, not hardcoded — the scaffolded code has a placeholder marked for replacement.
- Deezer's API (§7a) needs no key or secret at all, so nothing to configure there beyond outbound internet access from the EC2 instance.
- SQLite file needs to persist across restarts — keep it on the instance's root/EBS volume, back it up before any redeploy.
- For camera/mic access from guest phones, the join page **must be served over HTTPS** — browsers block `getUserMedia` on plain HTTP except for `localhost`. Get a real cert (Let's Encrypt via certbot is fastest) before demoing live mic/cam capture, even for the personal app.
- CORS: restrict `allow_origins` to the actual deployed frontend domain once it's not `localhost`.

---

## 11. Explicit non-goals for this build

- No real payment processing (bidding is logic-only, §4)
- No real Spotify/Apple Music OAuth for taste profiles (canned profile, §3)
- No real camera-based ML model for crowd analysis (simulated snapshot, §3)
- No horizontal scaling / multi-instance concerns
- No production-grade secret management (env vars are enough for a demo EC2 box)

Note: real track *playback* (§7a, via Deezer) and real *DJ/mood reasoning* (§8, via LLM calls) are both in scope and genuinely buildable — only the taste-profile OAuth and crowd-camera ML are simulated.

These are documented so whoever builds this doesn't accidentally burn hackathon time on infrastructure that isn't the point of the demo.
