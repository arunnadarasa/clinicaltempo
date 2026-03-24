# Stripe `purl` — NHS hackathon use case (Tempo + MPP + purl.dev demos)

**In-app:** **`/nhs/purl`** — copy-paste install, **Tempo / MPP** examples, and **purl.dev** free + paid smoke tests.

**What `purl` is:** A *curl*-style CLI for HTTP requests that may require payment — *payments + curl = purl* — built by [Stripe](https://www.purl.dev/). It supports **Tempo** and **MPP** (as well as x402). Source: **[github.com/stripe/purl](https://github.com/stripe/purl)**.

## Install

```bash
brew install stripe/purl/purl

# or
curl -fsSL https://www.purl.dev/install.sh | bash
```

## Wallet

```bash
purl wallet add
```

Add a **Tempo** wallet when prompted so MPP and balances work on Tempo networks.

## Tempo + MPP (native)

Check balances on **tempo** (e.g. USDC) and **tempo-moderato** (e.g. pathUSD):

```bash
purl balance
```

Example **paid** HTTP POST (uses purl’s payment path; illustrative third-party API):

```bash
purl -X POST https://climate.stripe.dev/api/contribute \
  -H "Content-Type: application/json" \
  -d '{"amount": 7}'
```

Then point `purl` at **this repo’s** MPP-gated NHS API (local):

- See [`docs/PURL_CLINICAL_TEMPO.md`](./PURL_CLINICAL_TEMPO.md) for `purl --dry-run -X POST` to `http://127.0.0.1:8787/api/nhs/...` on Tempo testnet.

## Official purl.dev smoke tests (Stripe-hosted)

| Endpoint | Payment |
|----------|---------|
| `https://www.purl.dev/test/free` | None |
| `https://www.purl.dev/test/paid` | **0.01 USDC** (demo) |

```bash
purl https://www.purl.dev/test/free
purl --dry-run https://www.purl.dev/test/paid
purl https://www.purl.dev/test/paid
```

These URLs are **not** your Tempo NHS server — they are the simplest free vs paid checks from [purl.dev](https://www.purl.dev/).

## Relationship to Clinical Tempo

- **Tempo MPP** powers **`/api/nhs/*`** when the payment gate is on (`NHS_ENABLE_PAYMENT_GATE` not `false`).
- Use **`purl balance`** + **Tempo** wallet to align CLI state with hackathon wallets; use **`docs/PURL_CLINICAL_TEMPO.md`** for local dry-runs and live POSTs.
