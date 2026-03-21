/**
 * Shared Tempo MPP helpers for live `POST /api/dance-extras/live/...` routes (browser wallet).
 * Used by ExtraDanceApp-style flows and PurlApp one-click pay.
 */
import { Mppx as MppxClient, tempo as tempoClient } from 'mppx/client'
import {
  type BrowserEthereumProvider,
  TEMPO_MPP_SESSION_MAX_DEPOSIT,
  tempoBrowserWalletTransport,
} from './tempoMpp'
import { createWalletClient } from 'viem'
import { tempo as tempoMainnet, tempoModerato } from 'viem/chains'
import { tempoActions } from 'viem/tempo'

export type TempoHubNetwork = 'testnet' | 'mainnet'

export const tempoTestnetChain = tempoModerato.extend({
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  feeToken: '0x20c0000000000000000000000000000000000001',
  blockTime: 30_000,
})

export const tempoMainnetChain = tempoMainnet.extend({
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  feeToken: '0x20c000000000000000000000b9537d11c60e8b50',
  blockTime: 30_000,
})

export const toHexChainId = (id: number) => `0x${id.toString(16)}`

export const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown error'
}

export const extractHexHash = (value: string) => {
  const prefixed = value.match(/0x[a-fA-F0-9]{64}/)
  if (prefixed) return prefixed[0]
  const bare = value.match(/\b[a-fA-F0-9]{64}\b/)
  return bare ? `0x${bare[0]}` : ''
}

export function httpFailureMessage(res: Response, text: string, data: unknown, fallback: string) {
  if (res.status === 404 && /cannot\s+post/i.test(text)) {
    return (
      'API route not found (404). Restart the backend (`npm run server` on port 8787) or run `npm run dev:full` with Vite. ' +
      'Verify: GET http://localhost:8787/api/dance-extras/live should return JSON with flowKeys.'
    )
  }
  const errObj = data && typeof data === 'object' ? (data as { error?: unknown; details?: unknown }) : null
  if (typeof errObj?.error === 'string' && errObj.error) return errObj.error
  if (errObj?.details != null) return String(errObj.details)
  const trimmed = text?.trim() ?? ''
  if (trimmed && !trimmed.startsWith('<!') && trimmed.length < 800) return trimmed
  return fallback
}

export function mapLivePayError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('timed out while waiting for call bundle id')) {
    return 'Wallet submitted the call bundle, but confirmation polling timed out. Check Tempo explorer.'
  }
  if (lower.includes('user rejected') || lower.includes('rejected the request')) {
    return 'Transaction approval was rejected in wallet.'
  }
  if (lower.includes('insufficientbalance') || lower.includes('amount exceeds balance')) {
    return 'Insufficient balance for this payment on selected network.'
  }
  return message
}

export async function parseResponseJson(res: Response) {
  const text = await res.text()
  try {
    return { data: text ? JSON.parse(text) : null, text }
  } catch {
    return { data: null, text }
  }
}

type EthWindow = {
  isMetaMask?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export async function addTempoNetwork(ethereum: EthWindow, target: TempoHubNetwork) {
  const chain = target === 'testnet' ? tempoTestnetChain : tempoMainnetChain
  const rpcUrl = chain.rpcUrls.default.http[0]
  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: toHexChainId(chain.id),
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [rpcUrl],
        blockExplorerUrls: chain.blockExplorers?.default?.url ? [chain.blockExplorers.default.url] : [],
      },
    ],
  })
}

export async function ensureSelectedWalletNetwork(ethereum: EthWindow, network: TempoHubNetwork) {
  const chain = network === 'testnet' ? tempoTestnetChain : tempoMainnetChain
  const chainIdHex = toHexChainId(chain.id)
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (err: unknown) {
    const e = err as { code?: number }
    if (e?.code === 4902) {
      await addTempoNetwork(ethereum, network)
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
      return
    }
    throw err
  }
}

export async function liveMppFetch(
  url: string,
  init: RequestInit,
  opts: { walletAddress: `0x${string}`; network: TempoHubNetwork },
): Promise<Response> {
  const { walletAddress, network } = opts
  const eth = window.ethereum as BrowserEthereumProvider | undefined
  if (!eth) throw new Error('Wallet not found.')
  await ensureSelectedWalletNetwork(eth as EthWindow, network)
  const chain = network === 'testnet' ? tempoTestnetChain : tempoMainnetChain
  const walletClient = createWalletClient({
    chain,
    transport: tempoBrowserWalletTransport(eth, chain.rpcUrls.default.http[0]),
    account: walletAddress,
  }).extend(tempoActions())

  const makeMppx = (mode: 'push' | 'pull') =>
    MppxClient.create({
      methods: [
        tempoClient({
          account: walletAddress,
          mode,
          maxDeposit: TEMPO_MPP_SESSION_MAX_DEPOSIT,
          getClient: async () => walletClient,
        }),
      ],
      polyfill: false,
    })

  try {
    return await makeMppx('push').fetch(url, init)
  } catch (pushErr) {
    const isMetaMask = Boolean((eth as { isMetaMask?: boolean }).isMetaMask)
    if (isMetaMask) throw pushErr
    return await makeMppx('pull').fetch(url, init)
  }
}
