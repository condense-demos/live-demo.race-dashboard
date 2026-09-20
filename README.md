# live-demo.race-dashboard

Booth display for **Live Race** — a multi-lane track + leaderboard that
updates in real time as visitors tap the controller. Meant to run on a TV
or shared screen at the booth for however many hours the event runs.

Built with Next.js (App Router) + Tailwind + Recharts, deployed to Vercel.

## How it works

- On load, connects to `relay-service` at `NEXT_PUBLIC_RELAY_WEBSOCKET_URL`
  over WebSocket (see [`lib/useRaceSocket.js`](./lib/useRaceSocket.js)).
- Renders one lane per active `session_id`, with a vehicle icon positioned
  by that session's live `distance`.
- Renders the leaderboard as a ranked horizontal bar chart (Recharts),
  driven by `race.leaderboard` snapshots relayed over the socket.
- Shows a countdown while `race_status === "running"`, and a "Race over —
  winner: X" banner when `race_status === "ended"`.
- If the WebSocket drops and fails to reconnect a few times in a row (venue
  WiFi), it falls back to polling `relay-service`'s `GET /leaderboard` and
  `GET /state` endpoints once a second, and switches back to WebSocket
  automatically once it reconnects — no page reload needed either way.

See [`PROTOCOL.md`](https://github.com/condense-demos/live-demo.race-backend/blob/main/PROTOCOL.md)
in `race-backend` for the exact WebSocket frame shapes this reads.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_RELAY_WEBSOCKET_URL
npm run dev
```

Open `http://localhost:3000`. Drive it end to end by running
`race-backend`'s three services locally and sending taps via
`race-controller` (or `curl`, see `race-backend`'s README).

## Env vars

Only `.env.example` is committed. Copy it to `.env.local` for local dev, and
set the same variable in Vercel's Project Settings for deployed
environments.

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_RELAY_WEBSOCKET_URL` | Public `wss://` URL of the deployed `relay-service` (no trailing slash) |

## Deploying

Deploy this repo directly to Vercel (framework preset: Next.js). Set
`NEXT_PUBLIC_RELAY_WEBSOCKET_URL` to the public WSS URL of the `relay-service`
Condense deployment — it must be reachable directly from the visitor's/booth's
browser, not just from inside Condense's network (see the networking note
in `race-backend`'s README, flagged there for platform verification).

## Assumption flagged

Framework choice (Next.js) matches the `NEXT_PUBLIC_*` env var convention in
the brief, same as `race-controller` — see that repo's README for the note
on porting to a different React setup if needed.
