import type { NhsNetwork } from './nhsSession'

export type NhsTxItem = {
  /** MPP chain receipt (`0x…`) or synthetic `audit:…` id when no on-chain receipt was returned */
  txHash: string
  network: NhsNetwork
  endpoint: string
  createdAt: string
  kind?: 'chain' | 'audit'
  /** Entity id from API body when `kind` is audit */
  auditRef?: string
}

const KEY = 'nhs_tx_history_v1'

export function listNhsTxHistory(): NhsTxItem[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as NhsTxItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.txHash === 'string' && typeof item.network === 'string')
      .map((item) => ({
        ...item,
        kind:
          item.kind ??
          (typeof item.txHash === 'string' && item.txHash.startsWith('0x') ? 'chain' : 'audit'),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

export function addNhsTxHistory(item: NhsTxItem) {
  const prev = listNhsTxHistory()
  const deduped = prev.filter((p) => !(p.txHash === item.txHash && p.network === item.network))
  const next = [item, ...deduped].slice(0, 500)
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function clearNhsTxHistory() {
  localStorage.removeItem(KEY)
}

export function explorerUrl(network: NhsNetwork, txHash: string): string | null {
  if (!txHash.startsWith('0x')) return null
  return network === 'mainnet'
    ? `https://explore.tempo.xyz/receipt/${txHash}`
    : `https://explore.testnet.tempo.xyz/receipt/${txHash}`
}

/** Wallet account page on Tempo explorer (useful when there is no `/receipt/0x…` for audit-only rows). */
export function explorerAddressUrl(network: NhsNetwork, walletAddress: string): string | null {
  const w = walletAddress.trim().toLowerCase()
  if (!/^0x[a-f0-9]{8,}$/i.test(w)) return null
  return network === 'mainnet'
    ? `https://explore.tempo.xyz/address/${w}`
    : `https://explore.testnet.tempo.xyz/address/${w}`
}

