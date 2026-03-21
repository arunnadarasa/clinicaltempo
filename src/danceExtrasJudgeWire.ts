/**
 * Shared copy-paste strings + payload for judge-score live MPP routes (testnet/mainnet).
 */
import type { TempoHubNetwork } from './danceExtrasLiveMpp'

export const LOCAL_API = 'http://127.0.0.1:8787'

export const BODY_TESTNET_STR = `{"network":"testnet","battleId":"battle_demo","roundId":"round_1","judgeId":"judge_1","dancerId":"dancer_1","score":8.7}`

export const BODY_MAINNET_STR = `{"network":"mainnet","battleId":"battle_demo","roundId":"round_1","judgeId":"judge_1","dancerId":"dancer_1","score":8.7}`

export function judgePayload(network: TempoHubNetwork): Record<string, unknown> {
  return JSON.parse(network === 'testnet' ? BODY_TESTNET_STR : BODY_MAINNET_STR)
}

export function bodyString(network: TempoHubNetwork) {
  return network === 'testnet' ? BODY_TESTNET_STR : BODY_MAINNET_STR
}

export function buildCurlJudgeWire(network: TempoHubNetwork): string {
  const path = network === 'testnet' ? 'testnet' : 'mainnet'
  const body = bodyString(network)
  return `curl -s -w "\\nHTTP:%{http_code}\\n" -X POST \\
  "${LOCAL_API}/api/dance-extras/live/judge-score/${path}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`
}

export function buildPurlDryRun(network: TempoHubNetwork): string {
  const path = network === 'testnet' ? 'testnet' : 'mainnet'
  const body = bodyString(network)
  return `BODY='${body}'
purl --dry-run -v -X POST --json "$BODY" \\
  "${LOCAL_API}/api/dance-extras/live/judge-score/${path}"`
}

export function buildPurlLive(network: TempoHubNetwork): string {
  const path = network === 'testnet' ? 'testnet' : 'mainnet'
  const body = bodyString(network)
  return `BODY='${body}'
purl --confirm -X POST --json "$BODY" \\
  "${LOCAL_API}/api/dance-extras/live/judge-score/${path}"`
}

/** `tempo request` against local DanceTempo API for copy-paste. */
export function buildTempoRequestLocal(network: TempoHubNetwork): string {
  const path = network === 'testnet' ? 'testnet' : 'mainnet'
  const body = bodyString(network)
  return `BODY='${body}'

tempo request --dry-run -X POST --json "$BODY" \\
  "${LOCAL_API}/api/dance-extras/live/judge-score/${path}"

# When ready to pay on-chain (${network} funds required):
tempo request -X POST --json "$BODY" \\
  "${LOCAL_API}/api/dance-extras/live/judge-score/${path}"`
}
