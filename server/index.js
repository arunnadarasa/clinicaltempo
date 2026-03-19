import 'dotenv/config'
import express from 'express'
import { Receipt } from 'mppx'
import { Mppx as MppxServer, tempo as tempoServer } from 'mppx/server'
import { createPublicClient, http } from 'viem'
import { tempo as tempoMainnetChain, tempoModerato as tempoTestnetChain } from 'viem/chains'
import {
  createBattleEntryIntent,
  createBeatLicenseIntent,
  createMockReceipt,
  endCoachingSession,
  executeBattlePayout,
  finalizeBattleResults,
  getBattlePayoutExecution,
  getCoachingReceipt,
  getVirtualDebitCard,
  grantBeatLicense,
  recoverBattleEntryPayment,
  startCoachingSession,
  tickCoachingSession,
  createVirtualDebitCard,
  verifyBattleEntryPayment,
} from './payments.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const mppSecretKey =
  process.env.MPP_SECRET_KEY || 'dev_only_replace_with_real_secret_key'

const liveMppByNetwork = {
  testnet: MppxServer.create({
    methods: [
      tempoServer({
        testnet: true,
        recipient: process.env.MPP_RECIPIENT,
      }),
    ],
    secretKey: mppSecretKey,
  }),
  mainnet: MppxServer.create({
    methods: [
      tempoServer({
        testnet: false,
        recipient: process.env.MPP_RECIPIENT,
      }),
    ],
    secretKey: mppSecretKey,
  }),
}

const judgeScores = []
const cypherMicropots = new Map()
const clipSales = new Map()
const reputationAttestations = []
const studioUsageEvents = []
const botActions = []
const fanPasses = new Map()
const tip20Launches = []
const coachingLiveRecoveryByTx = new Map()
const beatsLiveRecoveryByTx = new Map()
// Laso card x402 wrapper returns bearer tokens (id_token/refresh_token) with the card order.
// We need them to poll /get-card-data for the real card details later.
const lasoCardAuthById = new Map()
// When Laso rejects (e.g., geo restriction like "US only"), we fall back to the local mock card.
const lasoCardDemoReasonById = new Map()

const randomHexAddress = () => {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `0x${hex}`
}

const publicClientByNetwork = {
  testnet: createPublicClient({
    chain: tempoTestnetChain,
    transport: http(tempoTestnetChain.rpcUrls.default.http[0]),
  }),
  mainnet: createPublicClient({
    chain: tempoMainnetChain,
    transport: http(tempoMainnetChain.rpcUrls.default.http[0]),
  }),
}

app.use(express.json({ limit: '1mb' }))

function toFetchRequest(req) {
  const origin = `${req.protocol}://${req.get('host')}`
  const url = new URL(req.originalUrl, origin).toString()
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else if (typeof value === 'string') {
      headers.set(key, value)
    }
  }
  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : JSON.stringify(req.body ?? {})
  return new Request(url, { method: req.method, headers, body })
}

async function sendFetchResponse(res, fetchResponse) {
  res.status(fetchResponse.status)
  fetchResponse.headers.forEach((value, key) => res.setHeader(key, value))
  const text = await fetchResponse.text()
  res.send(text)
}

function getForwardAuthHeaders(req) {
  const headers = {}
  const authorization = req.get('authorization')
  const payment = req.get('payment')
  const paymentReceipt = req.get('payment-receipt')
  if (typeof authorization === 'string' && authorization.length > 0) {
    headers.Authorization = authorization
  }
  if (typeof payment === 'string' && payment.length > 0) {
    headers.Payment = payment
  }
  if (typeof paymentReceipt === 'string' && paymentReceipt.length > 0) {
    headers['Payment-Receipt'] = paymentReceipt
  }
  return headers
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-proxy' })
})

app.post('/api/battle/live/entry/:network', async (req, res) => {
  const network = req.params.network === 'mainnet' ? 'mainnet' : 'testnet'
  const { battleId, dancerId, amountDisplay } = req.body ?? {}

  if (typeof battleId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected battleId and dancerId as strings.',
    })
  }

  const mppx = liveMppByNetwork[network]
  const normalizedAmount = Number.parseFloat(amountDisplay || '12.00')
  const safeAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : 12
  // mppx charge amount is token-denominated decimal string, not base units.
  const tokenAmount = safeAmount.toFixed(2)

  try {
    const handler = mppx.tempo.charge({
      amount: tokenAmount,
      description: `Battle ${battleId} entry for dancer ${dancerId}`,
      externalId: `battle_live_${battleId}_${dancerId}_${Date.now()}`,
    })
    const mppResponse = await handler(toFetchRequest(req))

    if (mppResponse.status === 402) {
      return sendFetchResponse(res, mppResponse.challenge)
    }

    const successResponse = mppResponse.withReceipt(
      Response.json({
        ok: true,
        network,
        battleId,
        dancerId,
        status: 'payment_finalized',
      }),
    )
    return sendFetchResponse(res, successResponse)
  } catch (error) {
    return res.status(400).json({
      error: 'Live onchain payment failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/battle/live/recover', (req, res) => {
  const { intentId, txHash, battleId, dancerId, amountDisplay, network } = req.body ?? {}
  if (typeof txHash !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected txHash as a string.',
    })
  }

  try {
    let targetIntentId = intentId
    if (typeof targetIntentId !== 'string' || targetIntentId.length === 0) {
      if (typeof battleId !== 'string' || typeof dancerId !== 'string') {
        return res.status(400).json({
          error:
            'Missing intentId. Provide intentId, or provide battleId + dancerId so server can recreate the intent.',
        })
      }
      const recreated = createBattleEntryIntent({ battleId, dancerId, amountDisplay, network })
      targetIntentId = recreated.intentId
    }

    let recovered
    try {
      recovered = recoverBattleEntryPayment({ intentId: targetIntentId, txHash })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (
        message.includes('Battle entry intent not found.') &&
        typeof battleId === 'string' &&
        typeof dancerId === 'string'
      ) {
        const recreated = createBattleEntryIntent({ battleId, dancerId, amountDisplay, network })
        recovered = recoverBattleEntryPayment({ intentId: recreated.intentId, txHash })
      } else {
        throw error
      }
    }
    return res.status(200).json({
      intentId: recovered.intentId,
      status: recovered.status,
      chainId: recovered.chainId,
      recovered: true,
      txHash,
      paymentReceipt: recovered.receipt ? Receipt.serialize(recovered.receipt) : null,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to recover live battle payment.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/battle/live/confirm-and-recover', async (req, res) => {
  const { intentId, txHash, battleId, dancerId, amountDisplay, network } = req.body ?? {}
  const resolvedNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'
  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    return res.status(400).json({
      error: 'Invalid payload. Expected txHash as 0x-prefixed hash string.',
    })
  }

  try {
    const client = publicClientByNetwork[resolvedNetwork]
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') {
      return res.status(409).json({
        error: 'Transaction found but not successful.',
        txHash,
        onchainStatus: receipt.status,
      })
    }

    let targetIntentId = intentId
    if (typeof targetIntentId !== 'string' || targetIntentId.length === 0) {
      if (typeof battleId !== 'string' || typeof dancerId !== 'string') {
        return res.status(400).json({
          error:
            'Missing intentId. Provide intentId, or provide battleId + dancerId so server can recreate the intent.',
        })
      }
      const recreated = createBattleEntryIntent({
        battleId,
        dancerId,
        amountDisplay,
        network: resolvedNetwork,
      })
      targetIntentId = recreated.intentId
    }

    let recovered
    try {
      recovered = recoverBattleEntryPayment({ intentId: targetIntentId, txHash })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (
        message.includes('Battle entry intent not found.') &&
        typeof battleId === 'string' &&
        typeof dancerId === 'string'
      ) {
        const recreated = createBattleEntryIntent({
          battleId,
          dancerId,
          amountDisplay,
          network: resolvedNetwork,
        })
        recovered = recoverBattleEntryPayment({ intentId: recreated.intentId, txHash })
      } else {
        throw error
      }
    }

    return res.status(200).json({
      intentId: recovered.intentId,
      status: recovered.status,
      chainId: recovered.chainId,
      recovered: true,
      txHash,
      paymentReceipt: recovered.receipt ? Receipt.serialize(recovered.receipt) : null,
    })
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error'
    return res.status(404).json({
      error: 'Transaction not confirmed yet.',
      details,
      txHash,
    })
  }
})

app.post('/api/battle/entry', (req, res) => {
  const { battleId, dancerId, amountDisplay, paymentReceipt, simulatePayment, intentId, network } =
    req.body ?? {}

  if (typeof battleId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected battleId and dancerId as strings.',
    })
  }

  try {
    let intent
    if (typeof intentId === 'string' && intentId.length > 0) {
      intent = verifyBattleEntryPayment({
        intentId,
        paymentReceipt: null,
      })
      if (intent.battleId !== battleId || intent.dancerId !== dancerId) {
        return res.status(400).json({ error: 'intentId does not match battleId/dancerId.' })
      }
      const receiptHeader = req.get('payment-receipt')
      let suppliedReceipt = paymentReceipt || receiptHeader
      if (simulatePayment && intent.mode === 'mock' && !suppliedReceipt) {
        suppliedReceipt = createMockReceipt(intent)
      }
      if (typeof suppliedReceipt === 'string' && suppliedReceipt.length > 0) {
        intent = verifyBattleEntryPayment({ intentId, paymentReceipt: suppliedReceipt })
      }
    } else {
      intent = createBattleEntryIntent({ battleId, dancerId, amountDisplay, network })
      const receiptHeader = req.get('payment-receipt')
      let suppliedReceipt = paymentReceipt || receiptHeader
      if (simulatePayment && intent.mode === 'mock' && !suppliedReceipt) {
        suppliedReceipt = createMockReceipt(intent)
      }
      if (typeof suppliedReceipt === 'string' && suppliedReceipt.length > 0) {
        intent = verifyBattleEntryPayment({ intentId: intent.intentId, paymentReceipt: suppliedReceipt })
      }
    }

    return res.status(201).json({
      intentId: intent.intentId,
      status: intent.status,
      mode: intent.mode,
      testnet: intent.testnet,
      chainId: intent.chainId,
      paymentRequest: intent.requestEncoded,
      ...(intent.receipt ? { paymentReceipt: intent.receipt } : {}),
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to create or verify battle entry intent.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/battle/result', (req, res) => {
  const { battleId, winners } = req.body ?? {}
  const hasValidWinners =
    Array.isArray(winners) &&
    winners.length > 0 &&
    winners.every(
      (winner) =>
        winner &&
        typeof winner.dancerId === 'string' &&
        typeof winner.amountDisplay === 'string',
    )

  if (typeof battleId !== 'string' || !hasValidWinners) {
    return res.status(400).json({
      error:
        'Invalid payload. Expected battleId and winners[{ dancerId, amountDisplay }].',
    })
  }

  try {
    const result = finalizeBattleResults({ battleId, winners })
    return res.status(201).json({
      battleId: result.battleId,
      status: 'results_finalized',
      winners: result.winners,
      finalizedAt: result.finalizedAt,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to finalize battle results.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/payout/execute', (req, res) => {
  const { battleId, network } = req.body ?? {}

  if (typeof battleId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected battleId as a string.',
    })
  }

  try {
    const execution = executeBattlePayout({ battleId, network })
    return res.status(201).json({
      battleId: execution.battleId,
      mode: execution.mode,
      status: 'payout_executed',
      executedAt: execution.executedAt,
      payouts: execution.payouts,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to execute payout.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.get('/api/payout/:battleId', (req, res) => {
  const execution = getBattlePayoutExecution(req.params.battleId)
  if (!execution) {
    return res.status(404).json({ error: 'Payout execution not found.' })
  }
  return res.json(execution)
})

app.post('/api/coaching/start', (req, res) => {
  const { coachId, dancerId, ratePerMinute } = req.body ?? {}

  if (typeof coachId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected coachId and dancerId as strings.',
    })
  }

  const rate = Number(ratePerMinute ?? '2.5')
  if (!Number.isFinite(rate) || rate <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid ratePerMinute. Expected positive number.' })
  }

  try {
    const session = startCoachingSession({
      coachId,
      dancerId,
      ratePerMinute: rate,
    })
    return res.status(201).json({
      sessionId: session.id,
      status: session.status,
      ratePerMinute: session.ratePerMinute,
      createdAt: session.createdAt,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to start coaching session.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/coaching/live/start/:network', async (req, res) => {
  const network = req.params.network === 'mainnet' ? 'mainnet' : 'testnet'
  const { coachId, dancerId, ratePerMinute } = req.body ?? {}

  if (typeof coachId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected coachId and dancerId as strings.',
    })
  }

  const rate = Number(ratePerMinute ?? '2.5')
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({
      error: 'Invalid ratePerMinute. Expected positive number.',
    })
  }

  // Charge one minute upfront for live coaching session creation.
  const tokenAmount = rate.toFixed(2)
  const mppx = liveMppByNetwork[network]
  try {
    const handler = mppx.tempo.charge({
      amount: tokenAmount,
      description: `Coaching session start for ${dancerId} with ${coachId}`,
      externalId: `coaching_live_${coachId}_${dancerId}_${Date.now()}`,
    })
    const mppResponse = await handler(toFetchRequest(req))

    if (mppResponse.status === 402) {
      return sendFetchResponse(res, mppResponse.challenge)
    }

    const session = startCoachingSession({
      coachId,
      dancerId,
      ratePerMinute: rate,
    })

    const successResponse = mppResponse.withReceipt(
      Response.json({
        ok: true,
        network,
        sessionId: session.id,
        status: session.status,
        ratePerMinute: session.ratePerMinute,
        createdAt: session.createdAt,
      }),
    )
    return sendFetchResponse(res, successResponse)
  } catch (error) {
    return res.status(400).json({
      error: 'Live coaching session start failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/coaching/live/confirm-by-tx', async (req, res) => {
  const { txHash, coachId, dancerId, ratePerMinute, network } = req.body ?? {}
  const resolvedNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'

  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    return res.status(400).json({
      error: 'Invalid payload. Expected txHash as 0x-prefixed hash string.',
    })
  }
  if (typeof coachId !== 'string' || typeof dancerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected coachId and dancerId as strings.',
    })
  }

  const rate = Number(ratePerMinute ?? '2.5')
  if (!Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({
      error: 'Invalid ratePerMinute. Expected positive number.',
    })
  }

  try {
    const client = publicClientByNetwork[resolvedNetwork]
    const onchainReceipt = await client.getTransactionReceipt({ hash: txHash })
    if (onchainReceipt.status !== 'success') {
      return res.status(409).json({
        error: 'Transaction found but not successful.',
        txHash,
        onchainStatus: onchainReceipt.status,
      })
    }

    const recovered = coachingLiveRecoveryByTx.get(txHash)
    if (recovered) {
      return res.status(200).json({ ...recovered, recovered: true, txHash })
    }

    const session = startCoachingSession({
      coachId,
      dancerId,
      ratePerMinute: rate,
    })
    const payload = {
      network: resolvedNetwork,
      sessionId: session.id,
      status: session.status,
      ratePerMinute: session.ratePerMinute,
      createdAt: session.createdAt,
    }
    coachingLiveRecoveryByTx.set(txHash, payload)
    return res.status(200).json({ ...payload, recovered: true, txHash })
  } catch (error) {
    return res.status(404).json({
      error: 'Transaction not confirmed yet.',
      details: error instanceof Error ? error.message : 'Unknown error',
      txHash,
    })
  }
})

app.post('/api/coaching/ping-usage', (req, res) => {
  const { sessionId, seconds } = req.body ?? {}
  const secondsNumber = Number(seconds ?? 30)

  if (typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected sessionId as a string.',
    })
  }

  if (!Number.isFinite(secondsNumber) || secondsNumber <= 0) {
    return res
      .status(400)
      .json({ error: 'Invalid seconds. Expected positive number.' })
  }

  try {
    const session = tickCoachingSession({ sessionId, seconds: secondsNumber })
    return res.json({
      sessionId: session.id,
      status: session.status,
      seconds: session.seconds,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to record coaching usage.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/coaching/end', (req, res) => {
  const { sessionId } = req.body ?? {}

  if (typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected sessionId as a string.',
    })
  }

  try {
    const session = endCoachingSession({ sessionId })
    return res.json({
      sessionId: session.id,
      status: session.status,
      minutes: session.minutes,
      amountDisplay: session.amountDisplay,
      receipt: session.receipt,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to end coaching session.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.get('/api/coaching/:id/receipt', (req, res) => {
  const receipt = getCoachingReceipt(req.params.id)
  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found.' })
  }
  return res.json(receipt)
})

app.post('/api/beats/:id/license-intent', (req, res) => {
  const { id } = req.params
  const { consumerId, amountDisplay } = req.body ?? {}

  if (typeof consumerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected consumerId as a string.',
    })
  }

  try {
    const license = createBeatLicenseIntent({
      beatId: id,
      consumerId,
      amountDisplay,
    })
    return res.status(201).json({
      licenseId: license.licenseId,
      status: license.status,
      paymentRequest: license.requestEncoded,
      amountDisplay: license.amountDisplay,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to create beat license intent.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/beats/live/:id/license/:network', async (req, res) => {
  const network = req.params.network === 'mainnet' ? 'mainnet' : 'testnet'
  const { id } = req.params
  const { consumerId, amountDisplay } = req.body ?? {}

  if (typeof consumerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected consumerId as a string.',
    })
  }

  const normalizedAmount = Number.parseFloat(amountDisplay || '12.00')
  const safeAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : 12
  const tokenAmount = safeAmount.toFixed(2)
  const mppx = liveMppByNetwork[network]

  try {
    const handler = mppx.tempo.charge({
      amount: tokenAmount,
      description: `Beat ${id} license for consumer ${consumerId}`,
      externalId: `beats_live_${id}_${consumerId}_${Date.now()}`,
    })
    const mppResponse = await handler(toFetchRequest(req))

    if (mppResponse.status === 402) {
      return sendFetchResponse(res, mppResponse.challenge)
    }

    const licenseIntent = createBeatLicenseIntent({
      beatId: id,
      consumerId,
      amountDisplay: tokenAmount,
    })
    const license = grantBeatLicense({ licenseId: licenseIntent.licenseId })

    const successResponse = mppResponse.withReceipt(
      Response.json({
        ok: true,
        network,
        licenseId: license.licenseId,
        status: license.status,
        streamUrl: license.streamUrl,
        receipt: license.receipt,
      }),
    )
    return sendFetchResponse(res, successResponse)
  } catch (error) {
    return res.status(400).json({
      error: 'Live beat license payment failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/beats/live/:id/confirm-by-tx', async (req, res) => {
  const { id } = req.params
  const { txHash, consumerId, amountDisplay, network } = req.body ?? {}
  const resolvedNetwork = network === 'mainnet' ? 'mainnet' : 'testnet'

  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    return res.status(400).json({
      error: 'Invalid payload. Expected txHash as 0x-prefixed hash string.',
    })
  }
  if (typeof consumerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected consumerId as a string.',
    })
  }

  const normalizedAmount = Number.parseFloat(amountDisplay || '12.00')
  const safeAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : 12
  const tokenAmount = safeAmount.toFixed(2)
  const recoveryKey = `${resolvedNetwork}:${id}:${txHash}`

  try {
    const client = publicClientByNetwork[resolvedNetwork]
    const onchainReceipt = await client.getTransactionReceipt({ hash: txHash })
    if (onchainReceipt.status !== 'success') {
      return res.status(409).json({
        error: 'Transaction found but not successful.',
        txHash,
        onchainStatus: onchainReceipt.status,
      })
    }

    const recovered = beatsLiveRecoveryByTx.get(recoveryKey)
    if (recovered) {
      return res.status(200).json({ ...recovered, recovered: true, txHash })
    }

    const licenseIntent = createBeatLicenseIntent({
      beatId: id,
      consumerId,
      amountDisplay: tokenAmount,
    })
    const license = grantBeatLicense({ licenseId: licenseIntent.licenseId })
    const payload = {
      network: resolvedNetwork,
      licenseId: license.licenseId,
      status: license.status,
      streamUrl: license.streamUrl,
      receipt: license.receipt,
    }
    beatsLiveRecoveryByTx.set(recoveryKey, payload)
    return res.status(200).json({ ...payload, recovered: true, txHash })
  } catch (error) {
    return res.status(404).json({
      error: 'Transaction not confirmed yet.',
      details: error instanceof Error ? error.message : 'Unknown error',
      txHash,
    })
  }
})

app.post('/api/beats/:id/grant-access', (req, res) => {
  const { id } = req.params
  const { licenseId } = req.body ?? {}

  if (typeof licenseId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected licenseId as a string.',
    })
  }

  try {
    const license = grantBeatLicense({ licenseId })
    if (license.beatId !== id) {
      return res
        .status(400)
        .json({ error: 'licenseId does not belong to this beat.' })
    }
    return res.json({
      licenseId: license.licenseId,
      status: license.status,
      streamUrl: license.streamUrl,
      receipt: license.receipt,
    })
  } catch (error) {
    return res.status(400).json({
      error: 'Failed to grant beat access.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/judges/score', (req, res) => {
  const { battleId, roundId, judgeId, dancerId, score } = req.body ?? {}

  if (
    typeof battleId !== 'string' ||
    typeof roundId !== 'string' ||
    typeof judgeId !== 'string' ||
    typeof dancerId !== 'string' ||
    typeof score !== 'number'
  ) {
    return res.status(400).json({
      error:
        'Invalid payload. Expected battleId, roundId, judgeId, dancerId (strings) and score (number).',
    })
  }

  const entry = {
    id: judgeScores.length + 1,
    battleId,
    roundId,
    judgeId,
    dancerId,
    score,
    createdAt: new Date().toISOString(),
  }
  judgeScores.push(entry)

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_score_${battleId}_${roundId}_${judgeId}_${dancerId}`,
    status: 'success',
    timestamp: entry.createdAt,
    externalId: `score_${entry.id}`,
  })

  return res.status(201).json({ ...entry, receipt })
})

app.post('/api/cypher/micropot/contribute', (req, res) => {
  const { cypherId, dancerId, amount } = req.body ?? {}

  if (
    typeof cypherId !== 'string' ||
    typeof dancerId !== 'string' ||
    typeof amount !== 'number'
  ) {
    return res.status(400).json({
      error:
        'Invalid payload. Expected cypherId, dancerId (strings) and amount (number).',
    })
  }

  const pot =
    cypherMicropots.get(cypherId) ??
    {
      cypherId,
      total: 0,
      contributions: [],
    }

  const contribution = {
    dancerId,
    amount,
    contributedAt: new Date().toISOString(),
  }
  pot.total += amount
  pot.contributions.push(contribution)
  cypherMicropots.set(cypherId, pot)

  return res.status(201).json(pot)
})

app.post('/api/clips/sale', (req, res) => {
  const { clipId, buyerId, totalAmount, splits } = req.body ?? {}

  if (typeof clipId !== 'string' || typeof buyerId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected clipId and buyerId as strings.',
    })
  }

  if (!Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({
      error: 'Invalid payload. Expected non-empty splits[].',
    })
  }

  const saleId = `clip_${clipId}_${Date.now()}`
  const createdAt = new Date().toISOString()

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_clip_${clipId}_${saleId}`,
    status: 'success',
    timestamp: createdAt,
    externalId: saleId,
  })

  const sale = {
    saleId,
    clipId,
    buyerId,
    totalAmount,
    splits,
    createdAt,
    receipt,
  }

  clipSales.set(saleId, sale)
  return res.status(201).json(sale)
})

app.post('/api/reputation/attest', (req, res) => {
  const { issuerId, dancerId, type, eventId } = req.body ?? {}

  if (
    typeof issuerId !== 'string' ||
    typeof dancerId !== 'string' ||
    typeof type !== 'string'
  ) {
    return res.status(400).json({
      error: 'Invalid payload. Expected issuerId, dancerId, type as strings.',
    })
  }

  const attestation = {
    id: reputationAttestations.length + 1,
    issuerId,
    dancerId,
    type,
    eventId: typeof eventId === 'string' ? eventId : null,
    createdAt: new Date().toISOString(),
  }
  reputationAttestations.push(attestation)

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_reputation_${attestation.id}`,
    status: 'success',
    timestamp: attestation.createdAt,
    externalId: `reputation_${attestation.id}`,
  })

  return res.status(201).json({ ...attestation, receipt })
})

app.post('/api/studio/ai-usage', (req, res) => {
  const { studioId, toolId, units, mode } = req.body ?? {}

  if (
    typeof studioId !== 'string' ||
    typeof toolId !== 'string' ||
    typeof units !== 'number'
  ) {
    return res.status(400).json({
      error:
        'Invalid payload. Expected studioId, toolId (strings) and units (number).',
    })
  }

  const entry = {
    id: studioUsageEvents.length + 1,
    studioId,
    toolId,
    units,
    mode: mode === 'session' ? 'session' : 'charge',
    createdAt: new Date().toISOString(),
  }
  studioUsageEvents.push(entry)

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_ai_${entry.toolId}_${entry.id}`,
    status: 'success',
    timestamp: entry.createdAt,
    externalId: `ai_${entry.id}`,
  })

  return res.status(201).json({ ...entry, receipt })
})

app.post('/api/bot/action', (req, res) => {
  const { eventId, actionType, payload } = req.body ?? {}

  if (typeof eventId !== 'string' || typeof actionType !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected eventId and actionType as strings.',
    })
  }

  const action = {
    id: botActions.length + 1,
    eventId,
    actionType,
    payload: payload ?? {},
    createdAt: new Date().toISOString(),
  }
  botActions.push(action)

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_bot_${eventId}_${action.id}`,
    status: 'success',
    timestamp: action.createdAt,
    externalId: `bot_${action.id}`,
  })

  return res.status(201).json({ ...action, receipt })
})

app.post('/api/ops/agentmail/send', async (req, res) => {
  const { to, subject, text, html, inbox_id, network } = req.body ?? {}
  const effectiveInboxId = typeof inbox_id === 'string' && inbox_id.trim() ? inbox_id.trim() : process.env.AGENTMAIL_INBOX_ID
  const agentmailApiKey = process.env.AGENTMAIL_API_KEY

  if (typeof to !== 'string' || typeof subject !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected to and subject as strings.',
    })
  }

  if (typeof effectiveInboxId !== 'string' || !effectiveInboxId.trim()) {
    return res.status(400).json({
      error: 'Missing inbox_id for AgentMail send.',
      details: 'Provide `inbox_id` in request body or set AGENTMAIL_INBOX_ID on the server.',
    })
  }

  // Alternative strategy (more reliable in this environment):
  // 1) wallet pays this backend via Tempo MPP challenge
  // 2) backend executes AgentMail send via stable API-key endpoint
  //
  // This preserves wallet-paid UX while avoiding AgentMail MPP inbox scope mismatch.
  if (typeof agentmailApiKey === 'string' && agentmailApiKey.trim()) {
    const selectedNetwork = network === 'testnet' ? 'testnet' : 'mainnet'
    const mppx = liveMppByNetwork[selectedNetwork]
    const amount = Number.parseFloat(process.env.AGENTMAIL_SEND_FEE || '0.01')
    const safeAmount = Number.isFinite(amount) ? amount : 0.01
    const tokenAmount = safeAmount.toFixed(2)

    try {
      const handler = mppx.tempo.charge({
        amount: tokenAmount,
        description: `AgentMail send to ${to}`,
        externalId: `agentmail_send_${effectiveInboxId}_${Date.now()}`,
      })
      const mppResponse = await handler(toFetchRequest(req))
      if (mppResponse.status === 402) return sendFetchResponse(res, mppResponse.challenge)

      const apiBase = process.env.AGENTMAIL_BASE_URL || 'https://api.agentmail.to'
      const endpoint = `${apiBase.replace(/\/$/, '')}/v0/inboxes/${encodeURIComponent(effectiveInboxId)}/messages/send`
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agentmailApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          ...(typeof text === 'string' ? { text } : {}),
          ...(typeof html === 'string' ? { html } : {}),
        }),
      })

      const raw = await upstream.text()
      let data = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          error: 'AgentMail send failed.',
          upstreamStatus: upstream.status,
          upstreamEndpoint: endpoint,
          details: data ?? raw,
        })
      }

      const success = mppResponse.withReceipt(
        Response.json({
          provider: 'agentmail',
          status: 'sent',
          result: data ?? raw,
        }, { status: 201 }),
      )
      return sendFetchResponse(res, success)
    } catch (error) {
      return res.status(500).json({
        error: 'AgentMail request failed.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // No API key available: direct AgentMail MPP passthrough mode.
  const mppBaseUrl = process.env.AGENTMAIL_MPP_BASE_URL || 'https://mpp.api.agentmail.to'
  const endpoint = `${mppBaseUrl.replace(/\/$/, '')}/v0/inboxes/${encodeURIComponent(effectiveInboxId)}/messages/send`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Includes `Payment` and `Payment-Receipt` headers when the client
        // successfully solves an x402 challenge via mppx.
        ...getForwardAuthHeaders(req),
      },
      body: JSON.stringify({
        inbox_id: effectiveInboxId,
        to,
        subject,
        ...(typeof text === 'string' ? { text } : {}),
        ...(typeof html === 'string' ? { html } : {}),
      }),
    })

    // Preserve x402 challenge headers on 402 so the mppx client can solve and retry.
    if (response.status === 402) return sendFetchResponse(res, response)

    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'AgentMail send failed.',
        upstreamStatus: response.status,
        upstreamEndpoint: endpoint,
        details: data ?? raw,
      })
    }
    return res.status(201).json({
      provider: 'agentmail',
      status: 'sent',
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'AgentMail request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Create an AgentMail inbox using wallet-paid MPP (x402).
// The browser uses mppx/client to pay and forwards the resulting Payment headers to this route.
app.post('/api/ops/agentmail/inbox/create', async (req, res) => {
  const { username, domain, display_name, client_id } = req.body ?? {}
  const mppBaseUrl = process.env.AGENTMAIL_MPP_BASE_URL || 'https://mpp.api.agentmail.to'
  const endpoint = `${mppBaseUrl.replace(/\/$/, '')}/v0/inboxes`
  const agentmailApiKey = process.env.AGENTMAIL_API_KEY

  // AgentMail can auto-generate an inbox if `username` is omitted.
  // Validate only that provided fields are strings.
  const providedTypesOk =
    (typeof username === 'undefined' || typeof username === 'string') &&
    (typeof domain === 'undefined' || typeof domain === 'string') &&
    (typeof display_name === 'undefined' || typeof display_name === 'string') &&
    (typeof client_id === 'undefined' || typeof client_id === 'string')
  if (!providedTypesOk) {
    return res.status(400).json({
      error: 'Invalid payload for AgentMail inbox create.',
      details: 'Expected `username`, `domain`, `display_name`, and `client_id` as strings when provided.',
    })
  }

  const payload = {}
  if (typeof username === 'string' && username.trim()) payload.username = username.trim()
  if (typeof domain === 'string' && domain.trim()) payload.domain = domain.trim()
  if (typeof display_name === 'string' && display_name.trim()) payload.display_name = display_name.trim()
  if (typeof client_id === 'string' && client_id.trim()) payload.client_id = client_id.trim()

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof agentmailApiKey === 'string' && agentmailApiKey.trim()
          ? { Authorization: `Bearer ${agentmailApiKey.trim()}` }
          : {}),
        ...getForwardAuthHeaders(req), // includes `payment` and `payment-receipt` when solved
      },
      body: JSON.stringify(payload),
    })

    if (response.status === 402) return sendFetchResponse(res, response)

    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'AgentMail inbox create failed.',
        details: data ?? raw,
      })
    }

    return res.status(200).json({
      provider: 'agentmail',
      status: 'created',
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'AgentMail inbox create request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/fan-pass/purchase', (req, res) => {
  const { fanId, tier } = req.body ?? {}

  if (typeof fanId !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected fanId as a string.',
    })
  }

  const passId = `pass_${fanId}_${Date.now()}`
  const createdAt = new Date().toISOString()

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `mock_pass_${fanId}_${passId}`,
    status: 'success',
    timestamp: createdAt,
    externalId: passId,
  })

  const pass = {
    passId,
    fanId,
    tier: typeof tier === 'string' ? tier : 'standard',
    createdAt,
    perks: ['livestream_chat', 'backstage_qna', 'discounts'],
    receipt,
  }

  fanPasses.set(passId, pass)
  return res.status(201).json(pass)
})

app.post('/api/token/tip20/launch', (req, res) => {
  const {
    name,
    symbol,
    decimals,
    totalSupply,
    ownerAddress,
    network,
  } = req.body ?? {}

  if (typeof name !== 'string' || typeof symbol !== 'string' || typeof ownerAddress !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected name, symbol, and ownerAddress as strings.',
    })
  }

  const parsedDecimals = Number(decimals ?? 18)
  const parsedSupply = Number(totalSupply ?? 1000000)
  if (!Number.isFinite(parsedDecimals) || parsedDecimals < 0 || parsedDecimals > 18) {
    return res.status(400).json({ error: 'Invalid decimals. Expected number between 0 and 18.' })
  }
  if (!Number.isFinite(parsedSupply) || parsedSupply <= 0) {
    return res.status(400).json({ error: 'Invalid totalSupply. Expected positive number.' })
  }

  const launch = {
    launchId: `tip20_${Date.now()}`,
    network: network === 'mainnet' ? 'mainnet' : 'testnet',
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    decimals: parsedDecimals,
    totalSupply: parsedSupply,
    ownerAddress: ownerAddress.trim(),
    factoryAddress: '0x20fc000000000000000000000000000000000000',
    tokenAddress: randomHexAddress(),
    status: 'created',
    createdAt: new Date().toISOString(),
  }

  const receipt = Receipt.from({
    method: 'tempo',
    reference: `tip20_launch_${launch.symbol}_${launch.launchId}`,
    status: 'success',
    timestamp: launch.createdAt,
    externalId: launch.launchId,
  })

  const result = { ...launch, receipt }
  tip20Launches.unshift(result)
  if (tip20Launches.length > 100) tip20Launches.pop()

  return res.status(201).json(result)
})

app.get('/api/token/tip20/launches', (_req, res) => {
  return res.json({ items: tip20Launches })
})

app.post('/api/travel/stable/flights-search', async (req, res) => {
  const { originLocationCode, destinationLocationCode, departureDate, adults, max } = req.body ?? {}

  if (
    typeof originLocationCode !== 'string' ||
    typeof destinationLocationCode !== 'string' ||
    typeof departureDate !== 'string'
  ) {
    return res.status(400).json({
      error:
        'Invalid payload. Expected originLocationCode, destinationLocationCode, departureDate as strings.',
    })
  }

  const search = new URLSearchParams({
    originLocationCode,
    destinationLocationCode,
    departureDate,
    adults: String(Number.isFinite(Number(adults)) ? Number(adults) : 1),
    max: String(Number.isFinite(Number(max)) ? Number(max) : 5),
  })

  const url = `https://stabletravel.dev/api/flights/search?${search.toString()}`

  try {
    const response = await fetch(url, { method: 'GET' })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    // StableTravel uses x402/MPP. If payment challenge is returned, surface a clear operator hint.
    if (response.status === 402) {
      return res.status(402).json({
        error: 'StableTravel payment required (x402/MPP challenge).',
        details:
          'Use an MPP-capable client (e.g., npx agentcash fetch) or route via your MPP wallet flow for paid endpoint access.',
        endpoint: url,
        upstream: data ?? text,
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'StableTravel request failed.',
        details: data ?? text,
        endpoint: url,
      })
    }

    return res.json({
      provider: 'stabletravel',
      endpoint: url,
      result: data ?? text,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'StableTravel integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/travel/aviationstack/flights', async (req, res) => {
  const { flight_iata, dep_iata, arr_iata, flight_status, limit } = req.body ?? {}
  const apiKey = process.env.AVIATIONSTACK_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'AVIATIONSTACK_API_KEY is not set on the server.',
    })
  }

  const baseUrl = process.env.AVIATIONSTACK_BASE_URL || 'http://api.aviationstack.com/v1'
  const endpoint = `${baseUrl.replace(/\/$/, '')}/flights`
  const params = new URLSearchParams({ access_key: apiKey })
  if (typeof flight_iata === 'string' && flight_iata.trim()) params.set('flight_iata', flight_iata)
  if (typeof dep_iata === 'string' && dep_iata.trim()) params.set('dep_iata', dep_iata)
  if (typeof arr_iata === 'string' && arr_iata.trim()) params.set('arr_iata', arr_iata)
  if (typeof flight_status === 'string' && flight_status.trim()) {
    params.set('flight_status', flight_status)
  }
  if (Number.isFinite(Number(limit))) params.set('limit', String(Number(limit)))
  const url = `${endpoint}?${params.toString()}`

  try {
    const response = await fetch(url, { method: 'GET' })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Aviationstack request failed.',
        details: data ?? raw,
      })
    }
    return res.json({
      provider: 'aviationstack',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Aviationstack integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/travel/googlemaps/geocode', async (req, res) => {
  const { address, language, region } = req.body ?? {}
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'GOOGLE_MAPS_API_KEY is not set on the server.',
    })
  }

  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({
      error: 'Invalid payload. Expected address as a non-empty string.',
    })
  }

  const baseUrl = process.env.GOOGLE_MAPS_BASE_URL || 'https://maps.googleapis.com/maps/api'
  const endpoint = `${baseUrl.replace(/\/$/, '')}/geocode/json`
  const params = new URLSearchParams({
    key: apiKey,
    address: address.trim(),
  })
  if (typeof language === 'string' && language.trim()) params.set('language', language.trim())
  if (typeof region === 'string' && region.trim()) params.set('region', region.trim())
  const url = `${endpoint}?${params.toString()}`

  try {
    const response = await fetch(url, { method: 'GET' })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Google Maps request failed.',
        details: data ?? raw,
      })
    }
    return res.json({
      provider: 'google-maps',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Google Maps integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/travel/openweather/current', async (req, res) => {
  const { lat, lon, units } = req.body ?? {}
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENWEATHER_API_KEY is not set on the server.',
    })
  }

  const latNum = Number(lat)
  const lonNum = Number(lon)
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return res.status(400).json({
      error: 'Invalid payload. Expected lat and lon as numbers.',
    })
  }

  const baseUrl = process.env.OPENWEATHER_BASE_URL || 'https://weather.mpp.paywithlocus.com'
  const weatherPath = process.env.OPENWEATHER_CURRENT_PATH || '/data/2.5/weather'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${weatherPath.startsWith('/') ? weatherPath : `/${weatherPath}`}`
  const params = new URLSearchParams({
    lat: String(latNum),
    lon: String(lonNum),
    appid: apiKey,
  })
  if (typeof units === 'string' && units.trim()) params.set('units', units.trim())
  const url = `${endpoint}?${params.toString()}`

  try {
    const response = await fetch(url, { method: 'GET' })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (response.status === 402) {
      return res.status(402).json({
        error: 'OpenWeather payment required (MPP challenge).',
        details:
          'Use an MPP-capable client/wallet flow for paid access to weather endpoint.',
        endpoint: url,
        upstream: data ?? raw,
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'OpenWeather request failed.',
        details: data ?? raw,
      })
    }

    return res.json({
      provider: 'openweather',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'OpenWeather integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/market/kicksdb/search', async (req, res) => {
  const { query, market, per_page } = req.body ?? {}
  const apiKey = process.env.KICKSDB_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'KICKSDB_API_KEY is not set on the server.',
    })
  }

  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      error: 'Invalid payload. Expected query as a non-empty string.',
    })
  }

  const baseUrl = process.env.KICKSDB_BASE_URL || 'https://kicksdb.mpp.tempo.xyz'
  const searchPath = process.env.KICKSDB_SEARCH_PATH || '/v3/stockx/products'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${searchPath.startsWith('/') ? searchPath : `/${searchPath}`}`

  const params = new URLSearchParams({ query: query.trim() })
  if (typeof market === 'string' && market.trim()) params.set('market', market.trim().toUpperCase())
  if (Number.isFinite(Number(per_page))) params.set('per_page', String(Number(per_page)))
  const url = `${endpoint}?${params.toString()}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Forward MPP payment headers when the client uses an MPP-capable flow (x402).
        ...getForwardAuthHeaders(req),
      },
    })

    // Preserve x402 challenge headers on 402 so mppx/client can solve and retry.
    if (response.status === 402) return sendFetchResponse(res, response)

    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'KicksDB request failed.',
        details: data ?? raw,
      })
    }

    return res.json({
      provider: 'kicksdb',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'KicksDB integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/music/suno/generate', async (req, res) => {
  const { prompt, style, duration } = req.body ?? {}
  const apiKey = process.env.SUNO_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'SUNO_API_KEY is not set on the server.',
    })
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'Invalid payload. Expected prompt as a non-empty string.',
    })
  }

  const baseUrl = process.env.SUNO_BASE_URL || 'https://suno.mpp.paywithlocus.com'
  const generatePath = process.env.SUNO_GENERATE_PATH || '/api/generate'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${generatePath.startsWith('/') ? generatePath : `/${generatePath}`}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        ...(typeof style === 'string' && style.trim() ? { style: style.trim() } : {}),
        ...(Number.isFinite(Number(duration)) ? { duration: Number(duration) } : {}),
      }),
    })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (response.status === 402) {
      return res.status(402).json({
        error: 'Suno payment required (MPP challenge).',
        details:
          'Use an MPP-capable client/wallet flow for paid Suno endpoint access.',
        endpoint,
        upstream: data ?? raw,
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Suno request failed.',
        details: data ?? raw,
      })
    }

    return res.status(201).json({
      provider: 'suno',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Suno integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/ops/stablephone/call', async (req, res) => {
  const { phone_number, task, voice } = req.body ?? {}

  if (typeof phone_number !== 'string' || typeof task !== 'string') {
    return res.status(400).json({
      error: 'Invalid payload. Expected phone_number and task as strings.',
    })
  }

  const baseUrl = process.env.STABLEPHONE_BASE_URL || 'https://stablephone.dev'
  const callPath = process.env.STABLEPHONE_CALL_PATH || '/api/call'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${callPath.startsWith('/') ? callPath : `/${callPath}`}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getForwardAuthHeaders(req),
      },
      body: JSON.stringify({
        phone_number,
        task,
        ...(typeof voice === 'string' && voice.trim() ? { voice: voice.trim() } : {}),
      }),
    })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (response.status === 402) {
      return res.status(402).json({
        error: 'StablePhone payment required (x402/MPP challenge).',
        details:
          'Use an MPP-capable client/wallet flow for paid StablePhone call initiation.',
        endpoint,
        upstream: data ?? raw,
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'StablePhone call request failed.',
        details: data ?? raw,
      })
    }

    return res.status(201).json({
      provider: 'stablephone',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'StablePhone integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.get('/api/ops/stablephone/call/:id', async (req, res) => {
  const callId = req.params.id
  if (typeof callId !== 'string' || !callId.trim()) {
    return res.status(400).json({ error: 'Invalid call id.' })
  }

  const baseUrl = process.env.STABLEPHONE_BASE_URL || 'https://stablephone.dev'
  const statusPath = process.env.STABLEPHONE_STATUS_PATH || '/api/call'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${statusPath.startsWith('/') ? statusPath : `/${statusPath}`}/${encodeURIComponent(callId)}`

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        ...getForwardAuthHeaders(req),
      },
    })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'StablePhone status request failed.',
        details: data ?? raw,
      })
    }

    return res.json({
      provider: 'stablephone',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'StablePhone status integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/social/stablesocial/instagram-profile', async (req, res) => {
  const { username } = req.body ?? {}
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({
      error: 'Invalid payload. Expected username as a non-empty string.',
    })
  }

  const baseUrl = process.env.STABLESOCIAL_BASE_URL || 'https://stablesocial.dev'
  const profilePath =
    process.env.STABLESOCIAL_INSTAGRAM_PROFILE_PATH || '/api/instagram/profile'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${profilePath.startsWith('/') ? profilePath : `/${profilePath}`}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.trim() }),
    })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (response.status === 402) {
      return res.status(402).json({
        error: 'StableSocial payment required (x402/MPP challenge).',
        details:
          'Use an MPP-capable client/wallet flow for paid StableSocial fetch endpoints.',
        endpoint,
        upstream: data ?? raw,
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'StableSocial request failed.',
        details: data ?? raw,
      })
    }

    return res.status(201).json({
      provider: 'stablesocial',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'StableSocial integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.get('/api/social/stablesocial/jobs', async (req, res) => {
  const token = req.query.token
  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({
      error: 'Missing token query parameter.',
    })
  }

  const baseUrl = process.env.STABLESOCIAL_BASE_URL || 'https://stablesocial.dev'
  const jobsPath = process.env.STABLESOCIAL_JOBS_PATH || '/api/jobs'
  const endpoint = `${baseUrl.replace(/\/$/, '')}${jobsPath.startsWith('/') ? jobsPath : `/${jobsPath}`}`
  const url = `${endpoint}?${new URLSearchParams({ token }).toString()}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getForwardAuthHeaders(req),
      },
    })
    const raw = await response.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'StableSocial jobs poll failed.',
        details: data ?? raw,
        hint:
          response.status === 401 || response.status === 403
            ? 'StableSocial jobs polling requires SIWX wallet auth from the same paying wallet.'
            : undefined,
      })
    }

    return res.json({
      provider: 'stablesocial',
      endpoint,
      result: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'StableSocial jobs integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/card/create', async (req, res) => {
  const { walletAddress, amountDisplay, currency, label } = req.body ?? {}
  const requestedNetwork = req.body?.network === 'mainnet' ? 'mainnet' : 'testnet'

  if (typeof walletAddress !== 'string' || !walletAddress.startsWith('0x')) {
    return res.status(400).json({
      error: 'Invalid payload. Expected walletAddress as 0x-prefixed string.',
    })
  }

  const providerMode = (process.env.CARD_PROVIDER || 'laso').toLowerCase()
  const useLaso = providerMode === 'laso'

  const respondWithMock = () => {
    try {
      const card = createVirtualDebitCard({ walletAddress, amountDisplay, currency, label })
      return res.status(201).json({
        cardId: card.cardId,
        brand: card.brand,
        provider: card.provider,
        cardNumber: card.cardNumber,
        expiry: card.expiry,
        cvv: card.cvv,
        amountDisplay: card.amountDisplay,
        currency: card.currency,
        status: card.status,
        label: card.label,
        createdAt: card.createdAt,
        receipt: card.receipt,
      })
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to create virtual debit card.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const respondWithMockDemo = (demoReason) => {
    try {
      const card = createVirtualDebitCard({ walletAddress, amountDisplay, currency, label })
      lasoCardDemoReasonById.set(card.cardId, demoReason)
      return res.status(201).json({
        cardId: card.cardId,
        brand: card.brand,
        provider: card.provider,
        cardNumber: card.cardNumber,
        expiry: card.expiry,
        cvv: card.cvv,
        amountDisplay: card.amountDisplay,
        currency: card.currency,
        status: card.status,
        label: card.label,
        createdAt: card.createdAt,
        receipt: card.receipt,
        demo: true,
        demoReason,
      })
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to create virtual debit card.',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const isUsOnlyBlocked = (raw) => {
    const s = String(raw ?? '').toLowerCase()
    return (
      s.includes('us only') ||
      s.includes('united states') ||
      (s.includes('restricted') && s.includes('region')) ||
      (s.includes('not available') && (s.includes('us') || s.includes('united')))
    )
  }

  if (!useLaso) return respondWithMock()

  const mppx = liveMppByNetwork[requestedNetwork]
  const normalizedAmount = Number.parseFloat(amountDisplay || '5.00')
  const safeAmount = Number.isFinite(normalizedAmount) ? normalizedAmount : 5
  // mppx.tempo.charge expects a decimal-string amount (not base units).
  const tokenAmount = safeAmount.toFixed(2)

  try {
    const lasoBase = process.env.LASO_BASE_URL || 'https://laso.mpp.paywithlocus.com'
    const lasoPath = process.env.LASO_MPP_PATH || '/get-card'
    const lasoEndpoint = `${lasoBase.replace(/\/$/, '')}${lasoPath.startsWith('/') ? lasoPath : `/${lasoPath}`}`

    const lasoRequestBody = JSON.stringify({ amount: safeAmount, format: 'json' })
    const lasoHeaders = {
      'Content-Type': 'application/json',
      ...getForwardAuthHeaders(req), // includes `payment` and `payment-receipt` when MPP succeeded
    }

    let upstream = await fetch(lasoEndpoint, {
      method: 'POST',
      headers: lasoHeaders,
      body: lasoRequestBody,
    })

    let raw = await upstream.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    // Geo restricted (e.g. UK): avoid charging if Laso tells us it's US-only.
    const usOnlyCheck = data ? JSON.stringify(data) : raw
    if ((upstream.status === 403 || upstream.status === 400) && isUsOnlyBlocked(usOnlyCheck)) {
      return respondWithMockDemo('Demo mode: Laso prepaid card ordering is restricted to the United States (US only).')
    }

    if (upstream.status !== 402 && !upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Laso virtual card request failed.',
        details: data ?? raw,
        endpoint: lasoEndpoint,
        upstreamStatus: upstream.status,
      })
    }

    let mppResponse = null
    if (upstream.status === 402) {
      const handler = mppx.tempo.charge({
        amount: tokenAmount,
        description: `Virtual debit card creation for ${walletAddress}`,
        externalId: `virtual_card_${walletAddress}_${Date.now()}`,
      })

      mppResponse = await handler(toFetchRequest(req))
      if (mppResponse.status === 402) return sendFetchResponse(res, mppResponse.challenge)

      // Retry Laso now that the request includes payment headers.
      upstream = await fetch(lasoEndpoint, {
        method: 'POST',
        headers: lasoHeaders,
        body: lasoRequestBody,
      })

      raw = await upstream.text()
      data = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!upstream.ok) {
        const lasoErrText = data ? JSON.stringify(data) : raw
        if (
          upstream.status === 402 &&
          (lasoErrText.toLowerCase().includes('invalid challenge') || isUsOnlyBlocked(lasoErrText))
        ) {
          return respondWithMockDemo(
            'Demo mode: Laso prepaid card ordering is restricted to the United States (US only).',
          )
        }
        const payload = {
          error: 'Laso virtual card request failed.',
          details: data ?? raw,
          endpoint: lasoEndpoint,
          upstreamStatus: upstream.status,
        }
        const errRes = mppResponse.withReceipt(
          new Response(JSON.stringify(payload), {
            status: upstream.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        return sendFetchResponse(res, errRes)
      }
    }

    const cardData = data?.card || data?.result?.card || data?.result || data
    const auth = data?.auth || data?.authentication || {}
    const orderedCardId = cardData?.card_id || cardData?.cardId || cardData?.id || ''
    const idToken = auth?.id_token || auth?.idToken || ''
    const refreshToken = auth?.refresh_token || auth?.refreshToken || ''

    if (orderedCardId && idToken && refreshToken) {
      lasoCardAuthById.set(orderedCardId, { idToken, refreshToken })
    }

    const cardStatus = cardData?.status || 'pending'
    const payload = {
      provider: 'laso',
      source: 'laso-mpp',
      cardId: orderedCardId,
      brand: 'Visa',
      // /get-card returns pending card orders initially; poll /get-card-data for details.
      cardNumber: '',
      expiry: '',
      cvv: '',
      amountDisplay: safeAmount.toFixed(2),
      currency: 'USD',
      status: cardStatus === 'ready' ? 'ready' : 'idle',
      label: label || '',
      createdAt: new Date().toISOString(),
      receipt: null,
      raw: data ?? raw,
    }

    if (mppResponse) {
      const successRes = mppResponse.withReceipt(
        new Response(JSON.stringify(payload), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      return sendFetchResponse(res, successRes)
    }

    return res.status(201).json(payload)
  } catch (error) {
    return res.status(400).json({
      error: 'Virtual card MPP payment failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.get('/api/card/:id', async (req, res) => {
  const providerMode = (process.env.CARD_PROVIDER || 'laso').toLowerCase()
  const useLaso = providerMode === 'laso'

  if (!useLaso) {
    const card = getVirtualDebitCard(req.params.id)
    if (!card) return res.status(404).json({ error: 'Virtual card not found.' })
    return res.json(card)
  }

  const cardId = req.params.id
  if (typeof cardId !== 'string' || cardId.length === 0) {
    return res.status(400).json({ error: 'Invalid card id.' })
  }

  const lasoBase = process.env.LASO_BASE_URL || 'https://laso.mpp.paywithlocus.com'
  const statusPath = process.env.LASO_CARD_STATUS_PATH || '/get-card-data'
  const lasoEndpoint = `${lasoBase.replace(/\/$/, '')}${statusPath.startsWith('/') ? statusPath : `/${statusPath}`}`

  const authEntry = lasoCardAuthById.get(cardId)
  if (!authEntry?.idToken || !authEntry?.refreshToken) {
    // Demo fallback: if we already served a mock card (e.g. Laso US-only geo restriction),
    // we should still be able to poll and return the stored mock telemetry.
    const mock = getVirtualDebitCard(cardId)
    if (mock) {
      const demoReason = lasoCardDemoReasonById.get(cardId)
      return res.json({
        ...mock,
        provider: 'laso',
        source: 'laso-mpp',
        demo: true,
        demoReason,
      })
    }

    return res.status(400).json({
      error: 'Missing Laso auth tokens for this cardId.',
      details: 'Create the card first so we can store id_token/refresh_token for polling.',
      cardId,
    })
  }

  const callGetCardData = async (idToken) => {
    const upstream = await fetch(lasoEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...getForwardAuthHeaders(req),
      },
      body: JSON.stringify({ card_id: cardId, format: 'json' }),
    })

    const raw = await upstream.text()
    let data = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    return { upstream, raw, data }
  }

  try {
    let { upstream, raw, data } = await callGetCardData(authEntry.idToken)

    if (upstream.status === 401) {
      // Refresh id_token when it expires.
      const refreshEndpoint = `${lasoBase.replace(/\/$/, '')}/auth`
      const refreshRes = await fetch(refreshEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: authEntry.refreshToken,
        }),
      })
      const refreshRaw = await refreshRes.text()
      let refreshData = null
      try {
        refreshData = refreshRaw ? JSON.parse(refreshRaw) : null
      } catch {
        refreshData = null
      }

      if (!refreshRes.ok) {
        return res.status(refreshRes.status).json({
          error: 'Laso auth refresh failed while polling card data.',
          details: refreshData ?? refreshRaw,
        })
      }

      const newIdToken = refreshData?.id_token || refreshData?.idToken || ''
      const newRefreshToken = refreshData?.refresh_token || refreshData?.refreshToken || authEntry.refreshToken
      if (!newIdToken) {
        return res.status(401).json({
          error: 'Laso auth refresh returned no id_token.',
          details: refreshData ?? refreshRaw,
        })
      }

      lasoCardAuthById.set(cardId, {
        idToken: newIdToken,
        refreshToken: newRefreshToken,
      })

      ;({ upstream, raw, data } = await callGetCardData(newIdToken))
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Laso card status request failed.',
        details: data ?? raw,
        endpoint: lasoEndpoint,
      })
    }

    const cardData = data
    const details = cardData?.card_details || {}
    const expMonth = details?.exp_month || ''
    const expYear = details?.exp_year || ''
    const expiry =
      expMonth && expYear
        ? `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}`
        : cardData?.expiry || ''

    return res.json({
      provider: 'laso',
      source: 'laso-mpp',
      cardId: cardData?.card_id || cardData?.cardId || cardId,
      status: cardData?.status || 'unknown',
      cardNumber: details?.card_number || '',
      expiry,
      cvv: details?.cvv || '',
      balance: details?.available_balance ?? null,
      receipt: null,
      raw: data ?? raw,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Laso card status integration request failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/ai/explain-flow', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const { flowTitle, flowSubtitle, steps } = req.body ?? {}

  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not set on the server.',
    })
  }

  if (
    typeof flowTitle !== 'string' ||
    typeof flowSubtitle !== 'string' ||
    !Array.isArray(steps) ||
    steps.length === 0
  ) {
    return res.status(400).json({
      error: 'Invalid payload. Expected flowTitle, flowSubtitle, and steps[].',
    })
  }

  try {
    const prompt = [
      'You are explaining a DanceTech payment flow to non-technical users.',
      'Return 3 short bullets:',
      '1) Why this flow matters',
      '2) How payment works with MPP + Tempo',
      '3) What user trust benefit they get',
      '',
      `Flow title: ${flowTitle}`,
      `Flow subtitle: ${flowSubtitle}`,
      `Steps: ${steps.join(' -> ')}`,
    ].join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You write concise product explanations for payment-enabled web apps. Keep it plain and practical.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({
        error: 'OpenAI request failed.',
        details: errorText,
      })
    }

    const data = await response.json()
    const explanation = data?.choices?.[0]?.message?.content?.trim()

    if (!explanation) {
      return res.status(502).json({ error: 'OpenAI returned an empty response.' })
    }

    return res.json({ explanation, model })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected AI proxy error.',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.listen(port, () => {
  console.log(`AI proxy listening on http://localhost:${port}`)
})
