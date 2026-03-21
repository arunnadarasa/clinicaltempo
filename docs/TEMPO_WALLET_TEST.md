# Verifying Tempo Wallet CLI + DanceTempo (local)

Last verified with **Tempo CLI v1.4.3** and DanceTempo `server/index.js` on `http://127.0.0.1:8787`.

## 1) API returns `402` (no wallet)

```bash
curl -s -w "\nHTTP:%{http_code}\n" -X POST \
  "http://127.0.0.1:8787/api/dance-extras/live/judge-score/testnet" \
  -H "Content-Type: application/json" \
  -d '{"network":"testnet","battleId":"battle_demo","roundId":"round_1","judgeId":"judge_1","dancerId":"dancer_1","score":8.7}'
```

**Expected:** `HTTP:402` and JSON with `"title":"Payment Required"`, `challengeId`, etc.

## 2) Install `tempo` (official installer)

```bash
curl -fsSL https://tempo.xyz/install | bash
source ~/.tempo/env   # or restart shell
tempo --version
```

## 3) `tempo request --dry-run` **before** `tempo wallet login`

```bash
BODY='{"network":"testnet","battleId":"battle_demo","roundId":"round_1","judgeId":"judge_1","dancerId":"dancer_1","score":8.7}'
tempo request --dry-run -X POST --json "$BODY" \
  "http://127.0.0.1:8787/api/dance-extras/live/judge-score/testnet"
```

**Observed (expected):**

```text
code: E_USAGE
message: "Configuration missing: No key configured for network 'tempo-moderato'."
```

The CLI correctly associates the challenge with **Tempo Moderato (testnet)** but cannot sign until you configure a key via **`tempo wallet login`** (passkey flow).

## 4) After passkey login + fund (manual)

1. `tempo wallet login` — complete browser passkey at `wallet.tempo.xyz`.
2. `tempo wallet whoami`
3. `tempo wallet fund` (testnet) as needed.
4. Re-run the **`tempo request --dry-run`** command from §3.

You should see payment preview (amount, asset, recipient) similar to **`purl --dry-run`** / browser `mppx`, without the `E_USAGE` error.

## Summary

| Step | Result |
|------|--------|
| `curl` POST | `402` + payment challenge ✓ |
| `tempo request` without session | Clear error: need key for `tempo-moderato` ✓ |
| `tempo request` after login | User completes dry-run / pay (not automated in CI) |

This proves **DanceTempo’s MPP endpoint is compatible with the official Tempo Wallet’s network selection**; the remaining step is **human passkey login**, not a protocol mismatch.
