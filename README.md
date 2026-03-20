# DanceTech Protocol · DanceTempo

**DanceTech Protocol** is an open **pattern stack** for the dance industry: verifiable payments, session metering, media rights, reputation, AI usage billing, and event ops—**settled on [Tempo](https://tempo.xyz)** and **authorized via MPP / x402** so organizers, dancers, fans, and agents can pay APIs and each other with predictable receipts.

**DanceTempo** (this repo, `dancetempo`) is the **reference implementation**: a single hub, dedicated full-screen flows, and a Node/Express API that encodes the protocol in production-style code. Fork it to ship your own product; treat [`DANCETECH_USE_CASES.md`](./DANCETECH_USE_CASES.md) as the behavioral contract.

---

## What “super app” means here

| Layer | Role |
|--------|------|
| **Hub (`/`)** | Single home for **10+ DanceTech use cases** (battle entry, coaching, beats, judges, cypher pots, fan pass, reputation, studio AI, bot actions, etc.) with API previews and demos. |
| **Dedicated frontends** | Full-screen flows for **live Tempo testnet/mainnet** and complex UX (wallet, network, receipts, recovery). |
| **Backend (`server/`)** | Express API: MPP intents, live payment verification, proxies to paid APIs (KicksDB, AgentMail, travel, weather, etc.). |
| **Integrations** | Optional rails: AgentMail, StablePhone, StableSocial, StableTravel, Laso cards, Suno, Parallel, OpenWeather, OpenAI MPP (`/openai`), Google Maps, Aviationstack, KicksDB, TIP‑20 factory, OpenAI explainer. |

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8  
- **Payments:** `mppx` (client + server), **viem** + **Tempo** chain actions (`viem/tempo`, `viem/chains`)  
- **Backend:** Node.js, Express 5  
- **Docs in repo:** [`DANCETECH_USE_CASES.md`](./DANCETECH_USE_CASES.md) — flows, endpoints, testing notes  
- **Agent / tribal knowledge:** [`CLAWHUB.md`](./CLAWHUB.md) — successes, failures, debugging checklists  

### Local dev (Vite + API)

| Command | What runs |
|--------|------------|
| `npm run dev` | Vite only — **proxies `/api` → `http://localhost:8787`** |
| `npm run server` | Express API (default **port 8787**) |
| `npm run dev:full` | Both (recommended for live MPP flows) |

If the UI shows **`Cannot POST /api/...`** (HTML 404), the backend on **8787** is missing that route (often an **old** `node server/index.js` still running). **Restart** `npm run server`. Quick check: open **`GET http://localhost:8787/api/dance-extras/live`** — you should see JSON with `flowKeys`.

---

## Tempo & MPP (quick reference)

- **Tempo testnet (Moderato):** chain ID `42431` — typical fee/path asset: **pathUSD**  
- **Tempo mainnet:** chain ID `4217` — common fee token: **USDC** (e.g. bridged USDC.e where configured)  
- **MPP (Machine Payments Protocol):** server creates/verifies intents; browser can pay via injected wallet (`MetaMask` / Tempo wallet) using `MppxClient` + `tempoClient`.  
- **x402:** some third-party APIs return `402` + `WWW-Authenticate`; the app forwards challenges so `mppx` can pay and retry.

### MPP service directory (`mpp.dev`)

The **[Machine Payments Protocol service catalog](https://mpp.dev/services)** lists hosted integrations (base URLs, `POST` paths, and per-call pricing). Use it when adding new rails or checking upstream contracts. Agent-oriented discovery is often linked from that site as **`llms.txt`**.

**How this repo maps to the catalog**

| Catalog idea | In DanceTempo |
|--------------|----------------|
| Wallet pays via **402 → `mppx`** on **Tempo mainnet** | Same pattern on `/music` (Suno), `/travel`, `/kicks`, `/card`, etc. |
| **AgentMail** has two entry points | **`AGENTMAIL_BASE_URL`** (`https://api.agentmail.to`) for Bearer/API-key flows; **`AGENTMAIL_MPP_BASE_URL`** (`https://mpp.api.agentmail.to`) for wallet-paid MPP passthrough — both are named in `.env.example` and match [AgentMail on MPP](https://mpp.dev/services#agentmail). |
| **Suno** at `suno.mpp.paywithlocus.com` | **`SUNO_BASE_URL`** + `/suno/generate-music` — no vendor “Suno API key” in the UI; payment is MPP headers from the wallet. |
| **Parallel** at `parallelmpp.dev` | **`PARALLEL_BASE_URL`** — `/parallel` proxies search / extract / task (+ task poll). |
| **OpenWeather** at `weather.mpp.paywithlocus.com` | **`OPENWEATHER_BASE_URL`** — `/weather` uses wallet MPP; optional **`OPENWEATHER_API_KEY`** for server `appid`. |
| **OpenAI** at `openai.mpp.tempo.xyz` | **`OPENAI_MPP_BASE_URL`** — `/openai` proxies chat, images, speech & transcription (see `POST /api/openai/*`). |

---

## Routes (dedicated apps)

| Path | Purpose |
|------|---------|
| `/` | Main hub — all use cases + global transaction history |
| `/battle` | Battle entry + auto payout (live testnet/mainnet) |
| `/coaching` | Coaching minutes marketplace (live payments) |
| `/beats` | Beat API licensing (live payments) |
| `/dance-extras` | Seven core DanceTech flows (judge, cypher, clips, reputation, studio AI, bot, fan pass); **simulate** mock APIs or **Live Tempo MPP** via `POST /api/dance-extras/live/:flowKey/:network` |
| `/card` | Virtual debit card (Laso / MPP + demo fallback) |
| `/travel` | StableTravel, Aviationstack, Google Maps |
| `/email` | AgentMail ops (wallet-paid relay + send) |
| `/ops` | AgentMail + StablePhone console |
| `/social` | StableSocial |
| `/music` | Suno |
| `/parallel` | Parallel search / extract / task (MPP) |
| `/weather` | OpenWeather current conditions (MPP) |
| `/openai` | OpenAI chat completions (MPP gateway) |
| `/kicks` | KicksDB (live MPP + simulate) |
| `/tip20` | TIP‑20 token launch & post-launch ops |

---

## Core DanceTech capabilities (hub)

Examples wired in the main app and/or API:

1. **Battle entry + auto payout** — intents, results, payout execution  
2. **Judge score submission** — paid write API pattern  
3. **Cypher micropot** — session-style sponsorship  
4. **Coaching minutes** — start / tick usage / end + receipt  
5. **Beat licensing** — intent, grant access, recovery helpers  
6. **Clip marketplace** — listing + purchase scaffold  
7. **Fan reputation attestations**  
8. **Studio AI usage billing**  
9. **Tournament ops bot** — actions + AgentMail / phone / travel hooks  
10. **Fan membership battle pass**  

Full step-by-step and endpoint list: **[`DANCETECH_USE_CASES.md`](./DANCETECH_USE_CASES.md)**.

---

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env: API keys, MPP_RECIPIENT, Tempo flags, third-party URLs as needed.

# Terminal 1 — API (default port 8787)
npm run server

# Terminal 2 — Vite dev server (proxies /api → backend)
npm run dev
```

Or one command:

```bash
npm run dev:full
```

Open **http://localhost:5173** for the hub, or a path above (e.g. **http://localhost:5173/battle**).

**Production build:**

```bash
npm run build
npm run preview   # optional static preview; API still needs `npm run server` or your host
```

---

## Environment variables

Copy **`.env.example`** → **`.env`**. Never commit **`.env`** (it is gitignored).

Typical groups:

- **OpenAI** — `OPENAI_API_KEY` (optional; hub explainer + optional Bearer on MPP proxy), `OPENAI_MPP_BASE_URL` (default `https://openai.mpp.tempo.xyz`), `OPENAI_MODEL` (hub explainer default)  
- **MPP / Tempo** — `MPP_RECIPIENT`, `TMPO_TESTNET`, `PAYMENT_MODE`, etc.  
- **AgentMail** — `AGENTMAIL_API_KEY` (optional), `AGENTMAIL_BASE_URL` (direct API), **`AGENTMAIL_MPP_BASE_URL`** (wallet-paid host; default matches [mpp.dev#agentmail](https://mpp.dev/services#agentmail)), `AGENTMAIL_INBOX_ID`, `AGENTMAIL_SEND_FEE`  
- **Integrations** — KicksDB, StablePhone, StableSocial, Laso, Suno (`SUNO_BASE_URL`), Parallel (`PARALLEL_BASE_URL`), OpenWeather (`OPENWEATHER_BASE_URL`, optional `OPENWEATHER_API_KEY`), OpenAI MPP (`OPENAI_MPP_BASE_URL`), maps, aviation, etc.  

See `.env.example` for the full list and placeholders.

---

## Repository layout

```
├── src/           # React apps (App + route-specific *App.tsx)
├── server/        # Express API (index.js, payments.js)
├── public/        # Static assets
├── DANCETECH_USE_CASES.md
├── CLAWHUB.md     # Learning notes, failures, debugging playbooks
├── LOVABLE_HANDOFF.md
└── vite.config.ts # dev proxy: /api → http://localhost:8787
```

---

## Security & operations

- Keep **secrets in `.env`** only; rotate keys if exposed.  
- **Live mainnet** flows spend real assets — test on **testnet** first.  
- Transaction hashes can be recorded locally (see hub + dedicated pages) for audit; explorers: [Tempo mainnet](https://explore.tempo.xyz), [testnet](https://explore.testnet.tempo.xyz).  

---

## Contributing / fork

1. Fork or clone this repo  
2. Configure `.env` for the use cases you need  
3. Extend `server/index.js` or add a new `src/*App.tsx` + route in `src/main.tsx`  

---

## License

This project is licensed under the MIT License. See [`LICENSE`](./LICENSE).

---

**DanceTech Protocol** · **DanceTempo** — *Tempo + MPP for dance: one reference stack.*
