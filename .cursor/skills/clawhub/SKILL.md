---
name: clawhub
description: >-
  DanceTempo / DanceTech Protocol — use CLAWHUB.md for tribal debugging and
  public/llm-full.txt for full product + API context. Use when working in this
  repo, onboarding agents, or answering questions about Tempo, MPP, dance-extras,
  AgentMail, purl, or hub routes.
---

# ClawHub + DanceTempo context

## First load (full orientation)

1. Prefer **`public/llm-full.txt`** (or `/llm-full.txt` from the running app) — single bundle: README, use cases, protocol narrative, PURL/tempo notes, **and** `CLAWHUB.md`.
2. Regenerate the bundle after doc edits: `npm run build:llm` (also runs before `npm run build`).

## When debugging (tribal knowledge)

Read **`CLAWHUB.md`** at the repo root for:

- What succeeded / failed (Stripe purl, AgentMail, `402` loops, stale Express on 8787, etc.)
- Best practices and the “where to look” map

## Key implementation pointers

- Live MPP dance flows: `POST /api/dance-extras/live/:flowKey/:network` — verify with `GET /api/dance-extras/live`
- Hub route index: `src/hubRoutes.ts`
- Browser MPP helpers: `src/danceExtrasLiveMpp.ts`, `src/danceExtrasJudgeWire.ts`
- Server: `server/index.js`

## Skills vs runtime agents

- **Cursor / IDE:** @-mention `CLAWHUB.md` or `public/llm-full.txt` when context is needed.
- **OpenClaw / automation:** same files; keep secrets out of prompts (use `.env.example` names only).
