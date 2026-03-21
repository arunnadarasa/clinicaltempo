# MPPScan discovery (`/openapi.json`)

DanceTempo exposes **OpenAPI 3.1** at **`GET /openapi.json`** for **[MPPScan](https://www.mppscan.com/)** / AgentCash-style discovery.

- **Spec:** [Discovery Spec | MPPScan](https://www.mppscan.com/discovery)
- **Implementation:** `server/openapi.mjs` (builds the document) + `GET /openapi.json` in `server/index.js`
- **Paid routes:** Documented with **`x-payment-info`** (MPP + x402), **`402`** responses, and JSON **`requestBody`** schemas where required

## Local URLs

| Context | OpenAPI URL |
|--------|----------------|
| Express only | `http://localhost:8787/openapi.json` |
| Vite dev (proxied) | `http://localhost:5173/openapi.json` → 8787 |

## Validate before registering

```bash
# Terminal 1
npm run server

# Terminal 2 (with server up)
npm run discovery
```

Or manually:

```bash
npx -y @agentcash/discovery@latest discover "http://localhost:8787"
```

The **`discover`** command loads **`GET /openapi.json`** and lists routes + pricing. You may see **warnings** (e.g. `L2_AUTH_MODE_MISSING` on free routes, `WELLKNOWN_NOT_FOUND` if you have not added `/.well-known/x402`) — tighten the spec over time. Fix structural issues in `server/openapi.mjs` (and keep **`DANCE_EXTRA_LIVE_AMOUNTS`** in sync — it is the single source imported by `server/index.js`).

## Registration

After validation passes, register the **public origin** of your API (production or tunnel) on [MPPScan](https://www.mppscan.com/discovery). Add **`x-discovery.ownershipProofs`** as required by MPPScan when you have proofs.

## Precedence (MPPScan)

1. OpenAPI at `/openapi.json`
2. Runtime **`402`** + **`WWW-Authenticate`** — must match the documented MPP behavior
