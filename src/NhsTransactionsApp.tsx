import { useMemo, useState } from 'react'
import NhsShell from './NhsShell'
import {
  clearNhsTxHistory,
  explorerAddressUrl,
  explorerUrl,
  listNhsTxHistory,
  type NhsTxItem,
} from './nhsTxHistory'
import type { NhsNetwork, NhsPaymentMode, NhsRole } from './nhsSession'
import { getStoredWallet } from './nhsSession'

type Session = { role: NhsRole; wallet: string; network: NhsNetwork; paymentMode: NhsPaymentMode }

/** Clickable href for the transaction reference: Tempo /tx/ page (on-chain) or in-app deep link (audit). */
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

function TransactionsTable({ session }: { session: Session }) {
  const [rows, setRows] = useState<NhsTxItem[]>(() => listNhsTxHistory())

  const wallet = session.wallet || getStoredWallet()

  const tab = session.network
  const filtered = useMemo(() => rows.filter((row) => row.network === tab), [rows, tab])
  const hasAuditRows = useMemo(() => filtered.some((r) => !r.txHash.startsWith('0x')), [filtered])

  return (
    <section className="grid">
      <article className="card">
        <h2>Transaction history</h2>
        <p className="note tx-note-tight">
          Showing <strong>{tab}</strong> rows (matches header network). <strong>On-chain</strong> rows include a <code>/tx/…</code> link after a successful MPP payment. <strong>Audit</strong> rows only record the request; use <strong>Wallet on explorer</strong> to open your address and find the payment in the list — there is no per-row tx hash without MPP.
        </p>
        <div className="actions">
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
        {hasAuditRows && session.paymentMode === 'direct' ? (
          <p className="note">
            Tip: set payment mode to <strong>mpp wallet pay</strong> in the header so gated requests can complete payment and store a tx hash.
          </p>
        ) : null}
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
                          <a href={link} target="_blank" rel="noreferrer" title="Tempo transaction detail">
                            View transaction
                          </a>
                        ) : (
                          <>
                            {walletExplorer ? (
                              <a
                                href={walletExplorer}
                                target="_blank"
                                rel="noreferrer"
                                title="Your wallet on Tempo — find the payment in the transactions list (audit rows do not store a tx hash)."
                              >
                                Wallet on explorer
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
  )
}

export default function NhsTransactionsApp() {
  return (
    <NhsShell
      title="Transactions Audit"
      subtitle="On-chain rows link the Tempo transaction page (/tx/0x…). Audit rows have no stored tx hash; use Wallet on explorer to open your address and locate the payment. Use MPP + payment gate for per-request /tx/ links."
    >
      {(session) => <TransactionsTable session={session} />}
    </NhsShell>
  )
}
