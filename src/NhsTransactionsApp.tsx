import { useMemo, useState } from 'react'
import NhsShell from './NhsShell'
import {
  clearNhsTxHistory,
  explorerAddressUrl,
  explorerUrl,
  listNhsTxHistory,
  type NhsTxItem,
} from './nhsTxHistory'
import { getStoredNetwork, getStoredWallet } from './nhsSession'

/** Clickable href for the transaction reference: Tempo receipt (on-chain) or in-app deep link (audit). */
function transactionReferenceLink(row: NhsTxItem): { href: string; external: boolean } | null {
  const chain = explorerUrl(row.network, row.txHash)
  if (chain) return { href: chain, external: true }
  if (
    row.auditRef?.startsWith('gpr_') &&
    row.endpoint.includes('gp-access') &&
    !row.endpoint.includes('/gp-access/requests/')
  ) {
    return {
      href: `/nhs/gp-access?requestId=${encodeURIComponent(row.auditRef)}`,
      external: false,
    }
  }
  return null
}

export default function NhsTransactionsApp() {
  const [rows, setRows] = useState<NhsTxItem[]>(() => listNhsTxHistory())
  const [tab, setTab] = useState<'testnet' | 'mainnet'>(() => getStoredNetwork())
  const wallet = getStoredWallet()

  const filtered = useMemo(() => rows.filter((row) => row.network === tab), [rows, tab])

  return (
    <NhsShell
      title="Transactions Audit"
      subtitle="On-chain rows link the Tempo receipt. Audit rows have no receipt hash; Explorer opens your wallet on Tempo (same network as the row). Use MPP + payment gate for per-request receipt links. Switch testnet / mainnet to match the row."
    >
      {() => (
        <section className="grid">
          <article className="card">
            <h2>Transaction history</h2>
            <div className="actions">
              <button className={tab === 'testnet' ? '' : 'secondary'} onClick={() => setTab('testnet')}>
                Testnet
              </button>
              <button className={tab === 'mainnet' ? '' : 'secondary'} onClick={() => setTab('mainnet')}>
                Mainnet
              </button>
              <button className="secondary" onClick={() => setRows(listNhsTxHistory())}>
                Refresh
              </button>
              <button
                className="secondary"
                onClick={() => {
                  clearNhsTxHistory()
                  setRows([])
                }}
                disabled={rows.length === 0}
              >
                Clear all
              </button>
            </div>
            {filtered.length === 0 ? (
              <p className="note">
                No {tab} transactions recorded yet. Successful NHS writes (with MPP on-chain receipt or local audit) appear here.
              </p>
            ) : (
              <div className="tx-table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Endpoint</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const kind = row.kind ?? (row.txHash.startsWith('0x') ? 'chain' : 'audit')
                      const link = explorerUrl(row.network, row.txHash)
                      const refLabel =
                        kind === 'audit' && row.auditRef
                          ? row.auditRef
                          : row.txHash.length > 22
                            ? `${row.txHash.slice(0, 10)}…${row.txHash.slice(-8)}`
                            : row.txHash
                      const refLink = transactionReferenceLink(row)
                      const walletExplorer = explorerAddressUrl(row.network, wallet)
                      return (
                        <tr key={`${row.txHash}-${row.createdAt}`}>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>
                            <code>{row.endpoint}</code>
                          </td>
                          <td>
                            <span className={kind === 'chain' ? 'tx-badge tx-badge--chain' : 'tx-badge tx-badge--audit'}>
                              {kind === 'chain' ? 'On-chain' : 'Audit'}
                            </span>
                          </td>
                          <td>
                            {refLink ? (
                              <a
                                href={refLink.href}
                                title={row.txHash}
                                {...(refLink.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                              >
                                <code>{refLabel}</code>
                              </a>
                            ) : (
                              <code title={row.txHash}>{refLabel}</code>
                            )}
                          </td>
                          <td className="tx-explorer-cell">
                            {link ? (
                              <a href={link} target="_blank" rel="noreferrer">
                                View receipt
                              </a>
                            ) : (
                              <>
                                {walletExplorer ? (
                                  <a href={walletExplorer} target="_blank" rel="noreferrer">
                                    Tempo explorer
                                  </a>
                                ) : (
                                  <span className="tx-muted">Connect wallet</span>
                                )}
                                {refLink && !refLink.external ? (
                                  <>
                                    {' '}
                                    <span className="tx-muted">·</span>{' '}
                                    <a href={refLink.href}>In app</a>
                                  </>
                                ) : null}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      )}
    </NhsShell>
  )
}

