import { useMemo, useState } from 'react'
import NhsShell from './NhsShell'
import { clearNhsTxHistory, explorerUrl, listNhsTxHistory, type NhsTxItem } from './nhsTxHistory'
import { getStoredNetwork } from './nhsSession'

export default function NhsTransactionsApp() {
  const [rows, setRows] = useState<NhsTxItem[]>(() => listNhsTxHistory())
  const [tab, setTab] = useState<'testnet' | 'mainnet'>(() => getStoredNetwork())

  const filtered = useMemo(() => rows.filter((row) => row.network === tab), [rows, tab])

  return (
    <NhsShell
      title="Transactions Audit"
      subtitle="Audit MPP transaction hashes from NHS write actions. Rows without a chain receipt still appear as audit entries (e.g. payment gate off or direct mode). Switch between testnet and mainnet views."
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
                            <code title={row.txHash}>{refLabel}</code>
                          </td>
                          <td>
                            {link ? (
                              <a href={link} target="_blank" rel="noreferrer">
                                View receipt
                              </a>
                            ) : (
                              <span className="tx-muted">—</span>
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

