# DanceTempo (`dancetempo`)

A **super app** for the DanceTech industry: one codebase that combines **Tempo** (L1 payments), **MPP / x402** (machine payments), and **viem** so organizers, dancers, fans, and ops teams can run real payment flows and third‑party integrations from a single hub.

---

## What “super app” means here

| Layer | Role |
|--------|------|
| **Hub (`/`)** | Single home for **10+ DanceTech use cases** (battle entry, coaching, beats, judges, cypher pots, fan pass, reputation, studio AI, bot actions, etc.) with API previews and demos. |
| **Dedicated frontends** | Full-screen flows for **live Tempo testnet/mainnet** and complex UX (wallet, network, receipts, recovery). |
| **Backend (`server/`)** | Express API: MPP intents, live payment verification, proxies to paid APIs (KicksDB, AgentMail, travel, weather, etc.). |
| **Integrations** | Optional rails: AgentMail, StablePhone, StableSocial, StableTravel, Laso cards, Suno, OpenWeather, Google Maps, Aviationstack, KicksDB, TIP‑20 factory, OpenAI explainer. |

You can treat DanceTempo as a **reference implementation**: product teams pick a use case, wire their own keys/env, and ship.

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8  
- **Payments:** `mppx` (client + server), **viem** + **Tempo** chain actions (`viem/tempo`, `viem/chains`)  
- **Backend:** Node.js, Express 5  
- **Docs in repo:** [`DANCETECH_USE_CASES.md`](./DANCETECH_USE_CASES.md) — flows, endpoints, testing notes  

---

## Tempo & MPP (quick reference)

- **Tempo testnet (Moderato):** chain ID `42431` — typical fee/path asset: **pathUSD**  
- **Tempo mainnet:** chain ID `4217` — common fee token: **USDC** (e.g. bridged USDC.e where configured)  
- **MPP (Machine Payments Protocol):** server creates/verifies intents; browser can pay via injected wallet (`MetaMask` / Tempo wallet) using `MppxClient` + `tempoClient`.  
- **x402:** some third-party APIs return `402` + `WWW-Authenticate`; the app forwards challenges so `mppx` can pay and retry.

---

## Routes (dedicated apps)

| Path | Purpose |
|------|---------|
| `/` | Main hub — all use cases + global transaction history |
| `/battle` | Battle entry + auto payout (live testnet/mainnet) |
| `/coaching` | Coaching minutes marketplace (live payments) |
| `/beats` | Beat API licensing (live payments) |
| `/card` | Virtual debit card (Laso / MPP + demo fallback) |
| `/travel` | StableTravel, Aviationstack, Google Maps |
| `/email` | AgentMail ops (wallet-paid relay + send) |
| `/ops` | AgentMail + StablePhone console |
| `/social` | StableSocial |
| `/music` | Suno |
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

- **OpenAI** — `OPENAI_API_KEY` (server-side explainer only)  
- **MPP / Tempo** — `MPP_RECIPIENT`, `TMPO_TESTNET`, `PAYMENT_MODE`, etc.  
- **AgentMail** — `AGENTMAIL_API_KEY`, `AGENTMAIL_BASE_URL`, optional `AGENTMAIL_MPP_BASE_URL`, `AGENTMAIL_INBOX_ID`, `AGENTMAIL_SEND_FEE`  
- **Integrations** — KicksDB, StablePhone, StableSocial, Laso, Suno, weather, maps, aviation, etc.  

See `.env.example` for the full list and placeholders.

---

## Repository layout

```
├── src/           # React apps (App + route-specific *App.tsx)
├── server/        # Express API (index.js, payments.js)
├── public/        # Static assets
├── DANCETECH_USE_CASES.md
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

**DanceTempo** — *Tempo + MPP for DanceTech, one super app.*
