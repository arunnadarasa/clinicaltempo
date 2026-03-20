---
name: clawhub
description: Explain DanceTech Protocol (DanceTempo superapp), capabilities, and troubleshoot Tempo/MPP (x402) + AgentMail + dance-extras live routes. Use for repo learning, protocol summaries, payment/provider errors, stale API 404s, or local runbook guidance.
---

# ClawHub Skill: DanceTech Protocol + DanceTempo Troubleshooting

## Purpose
Answer questions about this repo as an **agent playbook** for **DanceTech Protocol** (the pattern stack) and **DanceTempo** (the reference app), specifically:
1) explaining what the protocol / superapp can do,
2) giving a repeatable debugging path for Tempo/MPP (x402/402), AgentMail, and **`/dance-extras/live`** issues,
3) providing “what to run / what to check” guidance without needing the user to open multiple files.

## Naming (ground truth)
- **DanceTech Protocol** — open pattern stack: dance-industry flows (battle, coaching, licensing, judging, sponsorship, reputation, AI billing, ops, fan pass) on **Tempo** + **MPP/x402**. Not a single on-chain contract; it’s **interoperable conventions + this reference codebase**.
- **DanceTempo** — this repository’s **reference implementation** (hub, dedicated routes, `server/`).

## Quick Reference (choose your path)
| User asks… | The skill should do… |
|---|---|
| “What is DanceTech Protocol?” | Explain pattern stack + Tempo/MPP + point to README + `DANCETECH_USE_CASES.md`. |
| “What can the superapp do?” | Use the architecture template (layers + routes + payments + where to read next). |
| “Why am I stuck on 402?” | Run the x402/402 loop checklist; ensure backend returns upstream `402` to `mppx`. |
| “Cannot POST /api/dance-extras/live/…” (404 HTML) | **Stale or wrong process on port 8787** — restart `npm run server` / `dev:full`; verify `GET http://localhost:8787/api/dance-extras/live` returns JSON with `flowKeys`. |
| “AgentMail fails: Inbox not found / Missing inbox_id” | Check `inbox_id` in body or `AGENTMAIL_INBOX_ID`; demo client uses `streetkode@agentmail.to` (`src/agentmailDemo.ts`). Prefer API-key send path when `AGENTMAIL_API_KEY` is set. |
| “StableSocial jobs fail / 401/403” | SIWX/auth: same wallet for paid trigger and polling. |
| “Laso card create/polling fails” | Laso flow + demo fallback when geo-restricted. |
| “How do I run locally?” | `npm run dev:full` + `.env` + ports 5173 / 8787. |
| “Add/modify docs” | README = product/protocol layer; `CLAWHUB.md` = learnings/failures; avoid README template-bulk merges. |

## Repo Primer (ground truth)
This repo implements **DanceTech Protocol** as a **DanceTempo superapp**:
- **Tempo**: on-chain settlement and receipts  
- **MPP**: `mppx` client/server for `402 Payment Required`  
- **Frontend**: hub + dedicated route apps  
- **Backend**: Express — intents, `402` passthrough, proxies  

Key files:
- `README.md` — protocol positioning + quick start + route list  
- `DANCETECH_USE_CASES.md` — flow steps + API mappings  
- `CLAWHUB.md` — successes, failures, best practices  
- `server/index.js` — integrations, `executeDanceExtraFlow`, `POST /api/dance-extras/live/...`, AgentMail  
- `vite.config.ts` — dev proxy `/api` → `http://localhost:8787`  
- `src/main.tsx` — `/dance-extras` **and** `/dance-extras/*` → `ExtraDanceApp`  

## Superapp Explanation Template
### 1) One-liner
**DanceTech Protocol** standardizes how dance products handle money and ops on **Tempo** with **MPP/x402**; **DanceTempo** is the reference superapp that implements it.

### 2) Architecture in layers
- **Hub (`/`)** — use-case selection + transaction history  
- **Dedicated frontends** — `/battle`, `/coaching`, `/beats`, `/dance-extras`, `/kicks`, etc.  
- **Backend** — MPP charges, `402` preservation, third-party proxies  
- **Integrations** — AgentMail, travel, weather, KicksDB, OpenAI MPP, etc.  

### 3) Dedicated routes (what’s where)
Include these in explanations (extend from README as needed):
- `/dance-extras` — seven core flows; **live MPP**: `POST /api/dance-extras/live/:flowKey/:network`  
- `/battle`, `/coaching`, `/beats` — live Tempo demos  
- `/email`, `/ops` — AgentMail + phone  
- `/kicks`, `/travel`, `/weather`, `/music`, `/parallel`, `/tip20`, etc.  

### 4) Payments (short mental model)
- Upstream **x402** → backend must return the **challenge** to the browser → `mppx` solves → retry with `payment` / `payment-receipt` headers.  

### 5) Where to read next
- `DANCETECH_USE_CASES.md`, `CLAWHUB.md`, `server/index.js`  

## Tempo & MPP Cheat Sheet
- **Testnet (Moderato):** chain id `42431`  
- **Mainnet:** chain id `4217`  
- Amounts: often **decimal strings**; server handlers use patterns like `toFixed(2)` for charges.  

## Local Runbook
1. `npm install`  
2. `cp .env.example .env`  
3. `npm run dev:full` (or `npm run server` + `npm run dev`)  
4. Open `http://localhost:5173`  
5. If **any** `/api` route 404s with Express “Cannot POST”, **restart the API** — old `node` process is common.  

## Environment Variables (minimum)
See `.env.example`. Highlights:
- **MPP:** `MPP_RECIPIENT`, `MPP_SECRET_KEY` (server)  
- **AgentMail:** `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID` or per-request `inbox_id`, `AGENTMAIL_BASE_URL`, `AGENTMAIL_MPP_BASE_URL`  

## Troubleshooting Playbooks

### A) x402 / 402 loop
Same as before: preserve upstream `402`, correct base URL, forward payment headers, match network, decimal amounts.

### B) `Cannot POST /api/dance-extras/live/...` (404)
1. Restart API on **8787**  
2. `GET http://localhost:8787/api/dance-extras/live` → must list `flowKeys`  
3. Ensure Vite proxy targets 8787 (`vite.config.ts`)  

### C) AgentMail: `Missing inbox_id` / `Inbox not found`
1. Set `inbox_id` in JSON or `AGENTMAIL_INBOX_ID` in `.env`  
2. Demo: `AGENTMAIL_DEMO_INBOX_ID` in `agentmailDemo.ts`  
3. With `AGENTMAIL_API_KEY`: wallet pays backend MPP charge, then Bearer send to `api.agentmail.to`  

### D) StableSocial polling (401/403)
Same wallet for trigger + poll; SIWX headers where required.  

### E) Laso card
Geo fallback to demo; poll needs tokens from create.  

## Output Contracts
1. Explain: layers + routes + payment model.  
2. Debug: most likely cause first, 2–5 steps, minimal questions.  

## Safety / Guardrails
- Never ask users to paste `.env` secrets.  
- Recommend **testnet** before mainnet.  
- Keep README coherent when editing docs.  
