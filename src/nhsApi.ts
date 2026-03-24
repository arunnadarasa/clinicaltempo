import { nhsMppFetch } from './nhsMpp'
import { getAuthHeaders, type NhsNetwork, type NhsPaymentMode, type NhsRole } from './nhsSession'
import { addNhsTxHistory } from './nhsTxHistory'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }
type ApiSuccess<T> = { ok: true; data: T; txHash: string | null; explorerUrl: string | null }
type ApiFailure = { ok: false; error: string; status: number }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function errorFromResponse(res: Response, payload: unknown): string {
  const status = res.status
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>
    if (typeof o.error === 'string' && o.error) return o.error
    if (typeof o.details === 'string' && o.details) return o.details
    if (typeof o.message === 'string' && o.message) return o.message
  }
  if (typeof payload === 'string' && payload.trim()) {
    const lower = payload.slice(0, 80).toLowerCase()
    if (lower.includes('<!doctype') || lower.includes('<html')) {
      if (status === 502 || status === 503 || status === 504) {
        return 'API server not reachable. Run `npm run server` (port 8787) or `npm run dev:full` alongside the Vite dev server.'
      }
      return `Server returned HTML (HTTP ${status}). Check that the API is running on port 8787.`
    }
    return payload.replace(/\s+/g, ' ').slice(0, 240)
  }
  if (status === 402) {
    return 'Payment required (402). Complete the wallet payment prompt, or set payment mode to direct fetch and disable the NHS payment gate on the server (NHS_ENABLE_PAYMENT_GATE=false).'
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'API server not reachable. Run `npm run server` (port 8787) or `npm run dev:full`.'
  }
  return `Request failed (HTTP ${status}).`
}

type ApiOpts = {
  network: NhsNetwork
  paymentMode: NhsPaymentMode
}

function extractTxHash(value: string): string | null {
  const match = value.match(/0x[a-fA-F0-9]{16,64}/)
  return match ? match[0] : null
}

function toExplorerUrl(network: NhsNetwork, txHash: string): string {
  return network === 'mainnet'
    ? `https://explore.tempo.xyz/tx/${txHash}`
    : `https://explore.testnet.tempo.xyz/tx/${txHash}`
}

function auditRefFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const o = payload as Record<string, unknown>
  for (const k of ['id', 'patientId', 'referralId', 'alertId', 'planId']) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function txFromResponse(payload: unknown, res: Response): string | null {
  const paymentReceipt = res.headers.get('payment-receipt') || ''
  const payment = res.headers.get('payment') || ''
  const payloadString = (() => {
    try {
      return JSON.stringify(payload ?? {})
    } catch {
      return ''
    }
  })()
  const merged = [paymentReceipt, payment, payloadString].filter(Boolean).join(' ')

  const direct = extractTxHash(merged)
  if (direct) return direct

  // Fallback: parse serialized receipt payloads and look for a reference field.
  for (const candidate of [paymentReceipt, payment]) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const reference = parsed.reference
      if (typeof reference === 'string') {
        const fromReference = extractTxHash(reference)
        if (fromReference) return fromReference
      }
    } catch {
      // Ignore non-JSON header values.
    }
  }
  return null
}

export async function apiPost<T>(
  path: string,
  role: NhsRole,
  wallet: string,
  body: unknown,
  opts: ApiOpts,
): Promise<ApiResponse<T>> {
  const reqInit: RequestInit = {
    method: 'POST',
    headers: getAuthHeaders(role, wallet),
    body: JSON.stringify({ ...(body as Record<string, unknown>), network: opts.network }),
  }
  let res: Response
  try {
    res =
      opts.paymentMode === 'mpp'
        ? await nhsMppFetch(path, reqInit, { wallet, network: opts.network })
        : await fetch(path, reqInit)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network error.'
    return { ok: false, error: msg, status: 0 }
  }
  const payload = await parseJsonSafe(res)
  if (!res.ok) return { ok: false, error: errorFromResponse(res, payload), status: res.status }
  const txHash = txFromResponse(payload, res)
  if (txHash) {
    addNhsTxHistory({
      txHash,
      network: opts.network,
      endpoint: path,
      createdAt: new Date().toISOString(),
      kind: 'chain',
    })
  } else {
    const auditRef = auditRefFromPayload(payload)
    addNhsTxHistory({
      txHash: `audit:${crypto.randomUUID()}`,
      network: opts.network,
      endpoint: path,
      createdAt: new Date().toISOString(),
      kind: 'audit',
      ...(auditRef ? { auditRef } : {}),
    })
  }
  return {
    ok: true,
    data: payload as T,
    txHash,
    explorerUrl: txHash ? toExplorerUrl(opts.network, txHash) : null,
  }
}

export async function apiGet<T>(
  path: string,
  role: NhsRole,
  wallet: string,
  _opts: ApiOpts,
): Promise<ApiResponse<T>> {
  void _opts
  let res: Response
  try {
    res = await fetch(path, { headers: getAuthHeaders(role, wallet) })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Network error.'
    return { ok: false, error: msg, status: 0 }
  }
  const payload = await parseJsonSafe(res)
  if (!res.ok) return { ok: false, error: errorFromResponse(res, payload), status: res.status }
  return { ok: true, data: payload as T, txHash: null, explorerUrl: null }
}

