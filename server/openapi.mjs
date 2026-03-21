/**
 * OpenAPI 3.1 document for MPPScan / AgentCash discovery.
 * @see https://www.mppscan.com/discovery
 *
 * Validate locally:
 *   npx -y @agentcash/discovery@latest check "http://localhost:8787"
 */

/** Mirrors `DANCE_EXTRA_LIVE_AMOUNTS` in index.js — keep in sync when prices change. */
export const DANCE_EXTRA_LIVE_AMOUNTS = {
  'judge-score': '0.01',
  'cypher-micropot': '0.02',
  'clip-sale': '0.05',
  reputation: '0.01',
  'ai-usage': '0.02',
  'bot-action': '0.03',
  'fan-pass': '0.04',
}

function amountRange() {
  const nums = Object.values(DANCE_EXTRA_LIVE_AMOUNTS).map(Number)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  return {
    minPrice: min.toFixed(6),
    maxPrice: max.toFixed(6),
  }
}

/**
 * @param {import('express').Request | null} req — if null, servers URL is "/"
 */
export function buildOpenApiDocument(req) {
  const { minPrice, maxPrice } = amountRange()
  const host = req?.get?.('host')
  const proto = req?.protocol || 'http'
  const baseUrl =
    host && typeof host === 'string' ? `${proto}://${host}` : '/'

  return {
    openapi: '3.1.0',
    info: {
      title: 'DanceTempo API',
      version: '1.0.0',
      description:
        'DanceTech Protocol reference backend — Tempo settlement, MPP / x402 machine payments, DanceTech use-case routes.',
      guidance:
        'DanceTempo exposes wallet-paid routes via Tempo MPP. For discovery, call GET /api/dance-extras/live to list flowKeys, then POST /api/dance-extras/live/{flowKey}/{network} with JSON body matching that flow (see DANCETECH_USE_CASES.md). Unpaid requests receive 402 + WWW-Authenticate; complete payment headers and retry. Use testnet first (network=testnet).',
    },
    servers: [{ url: baseUrl, description: 'This API (same origin as /openapi.json)' }],
    'x-discovery': {
      ownershipProofs: [],
    },
    paths: {
      '/api/health': {
        get: {
          operationId: 'health',
          summary: 'Health check',
          tags: ['Meta'],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { ok: { type: 'boolean' } },
                    required: ['ok'],
                  },
                },
              },
            },
          },
        },
      },
      '/api/dance-extras/live': {
        get: {
          operationId: 'danceExtrasLiveMeta',
          summary: 'List live MPP dance-extra flow keys (no payment)',
          tags: ['Dance extras'],
          description:
            'Returns flowKeys and networks for POST /api/dance-extras/live/{flowKey}/{network}. Use this to verify the server build (stale Node processes are a common failure mode).',
          responses: {
            200: {
              description: 'Metadata JSON',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      method: { type: 'string', enum: ['POST'] },
                      path: { type: 'string' },
                      flowKeys: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      networks: {
                        type: 'array',
                        items: { type: 'string', enum: ['testnet', 'mainnet'] },
                      },
                    },
                    required: ['ok', 'flowKeys', 'networks'],
                  },
                },
              },
            },
          },
        },
      },
      '/api/dance-extras/live/{flowKey}/{network}': {
        post: {
          operationId: 'danceExtrasLivePaid',
          summary: 'Execute a DanceTech extra flow with Tempo MPP (402 if unpaid)',
          tags: ['Dance extras'],
          description:
            'Charges pathUSD-style amount per flowKey (see server DANCE_EXTRA_LIVE_AMOUNTS). Body shape depends on flowKey — e.g. judge-score expects battleId, roundId, judgeId, dancerId, score. URL network overrides body.network for chain selection.',
          parameters: [
            {
              name: 'flowKey',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: Object.keys(DANCE_EXTRA_LIVE_AMOUNTS),
              },
              description: 'One of the seven live MPP scaffold flows',
            },
            {
              name: 'network',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: ['testnet', 'mainnet'],
              },
              description: 'Tempo network segment (Moderato vs mainnet)',
            },
          ],
          'x-payment-info': {
            pricingMode: 'range',
            minPrice,
            maxPrice,
            protocols: ['mpp', 'x402'],
          },
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description:
                    'Flow-specific payload; see DANCETECH_USE_CASES.md. Example for judge-score: battleId, roundId, judgeId, dancerId, score (number).',
                  properties: {
                    network: {
                      type: 'string',
                      enum: ['testnet', 'mainnet'],
                      description: 'Optional; URL segment takes precedence',
                    },
                    battleId: { type: 'string' },
                    roundId: { type: 'string' },
                    judgeId: { type: 'string' },
                    dancerId: { type: 'string' },
                    score: { type: 'number' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Flow result with optional MPP receipt headers on success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      mpp: { type: 'boolean' },
                      livePayment: { type: 'boolean' },
                    },
                    additionalProperties: true,
                  },
                },
              },
            },
            400: {
              description: 'Bad request or payment handler error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                    required: ['error'],
                  },
                },
              },
            },
            402: {
              description: 'Payment Required — complete MPP challenge (WWW-Authenticate)',
            },
          },
        },
      },
    },
  }
}
