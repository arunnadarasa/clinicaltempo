import { Credential, Receipt } from 'mppx'

/**
 * mppx charge() returns `{ status: 200, withReceipt(response) }` — there is no `mppResponse.receipt`.
 * Receipt data is only attached when `withReceipt()` runs (Payment-Receipt header). Extract it for DB + JSON.
 */
function resolvePaymentReceiptRef(req, mppResponse) {
  const head = req.get?.('payment-receipt')
  if (head) {
    try {
      return Receipt.deserialize(head).reference
    } catch {
      // ignore malformed header
    }
  }
  if (typeof mppResponse?.withReceipt === 'function') {
    try {
      const wrapped = mppResponse.withReceipt(
        new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
      )
      return Receipt.fromResponse(wrapped).reference
    } catch {
      // ignore
    }
  }
  try {
    const raw = req.headers.authorization
    if (typeof raw === 'string' && raw.startsWith('Payment ')) {
      const cred = Credential.deserialize(raw)
      if (cred.payload?.type === 'hash' && typeof cred.payload.hash === 'string') {
        return cred.payload.hash
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Wraps route handlers with optional Tempo MPP charge gate.
 * Expects dependencies from server/index.js to avoid duplicating transport internals.
 */
export function withTempoGate({ liveMppByNetwork, toFetchRequest, sendFetchResponse }, config, handler) {
  const {
    enabled = false,
    amount = '0.01',
    description = 'NHS service request',
    externalIdPrefix = 'nhs_service',
  } = config || {}

  return async (req, res) => {
    if (!enabled) {
      return handler(req, res, { paymentReceiptRef: null, network: req.body?.network || 'testnet' })
    }

    const network = req.body?.network === 'mainnet' ? 'mainnet' : 'testnet'
    const mppx = liveMppByNetwork[network]
    if (!mppx) {
      return res.status(400).json({ error: 'Unsupported payment network.' })
    }

    try {
      const charge = mppx.tempo.charge({
        amount,
        description,
        externalId: `${externalIdPrefix}_${Date.now()}`,
      })
      const mppResponse = await charge(toFetchRequest(req))
      if (mppResponse.status === 402) {
        return sendFetchResponse(res, mppResponse.challenge)
      }
      const receiptRef = resolvePaymentReceiptRef(req, mppResponse)
      return handler(req, res, { paymentReceiptRef: receiptRef, network })
    } catch (error) {
      return res.status(400).json({
        error: 'Tempo MPP payment gate failed.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

