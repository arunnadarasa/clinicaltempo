import { useState } from 'react'
import NhsShell from './NhsShell'
import { apiPost } from './nhsApi'
import { getStoredPatientId, setStoredPatientId } from './nhsSession'

type BootstrapResponse = {
  ok: boolean
  actor: { walletAddress: string; role: string }
  patient?: { patientId: string }
}

export default function NhsHubApp() {
  const [fullName, setFullName] = useState('Alex Carter')
  const [dob, setDob] = useState('1990-01-01')
  const [nhsNumber, setNhsNumber] = useState('999-999-9999')
  const [status, setStatus] = useState('Ready')
  const [patientId, setPatientId] = useState(getStoredPatientId())

  return (
    <NhsShell
      title="Neighbourhood Health Service Hub"
      subtitle="Digital front door aligned to NHS neighbourhood care, personalised care plans, social prescribing, and prevention-first monitoring."
    >
      {(session) => (
        <section className="grid">
          <article className="card">
            <h2>Hackathon quick start (under 2 minutes)</h2>
            <p>Use this path to get funded, bootstrap identity, and start testing flows quickly.</p>
            <ol className="log">
              <li>Connect wallet from the top bar.</li>
              <li>Keep network on <strong>tempo testnet</strong> and click <strong>Get testnet funds</strong>.</li>
              <li>Choose role, complete bootstrap fields, and click <strong>Bootstrap identity</strong>.</li>
            </ol>
            <p className="note">Tip: faucet is testnet-only and may take a short time to appear in wallet balance.</p>
          </article>
          <article className="card">
            <h2>Identity bootstrap</h2>
            <p>Initialize role + wallet identity and ensure patient record exists for patient role.</p>
            <div className="actions">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
              <input value={dob} onChange={(e) => setDob(e.target.value)} placeholder="DOB (YYYY-MM-DD)" />
              <input value={nhsNumber} onChange={(e) => setNhsNumber(e.target.value)} placeholder="NHS number" />
              <button
                disabled={!session.wallet}
                onClick={async () => {
                  const res = await apiPost<BootstrapResponse>(
                    '/api/nhs/identity/bootstrap',
                    session.role,
                    session.wallet,
                    {
                      role: session.role,
                      fullName,
                      dob,
                      nhsNumber,
                    },
                    { network: session.network, paymentMode: session.paymentMode },
                  )
                  if (!res.ok) {
                    setStatus(`Bootstrap failed: ${res.error}`)
                    return
                  }
                  const nextPatientId = res.data.patient?.patientId || ''
                  if (nextPatientId) {
                    setStoredPatientId(nextPatientId)
                    setPatientId(nextPatientId)
                  }
                  setStatus(`Identity ready (${res.data.actor.role})`)
                }}
              >
                Bootstrap identity
              </button>
            </div>
            <p className="intent">Status: <strong>{status}</strong></p>
            <p className="intent">Patient ID: <strong>{patientId || 'not set'}</strong></p>
          </article>
          <article className="card">
            <h2>NHS-aligned workflows</h2>
            <ul className="log">
              <li>Same-day GP access request flow</li>
              <li>Care plan authoring and updates</li>
              <li>Social prescribing referral + link worker support plan</li>
              <li>Neighbourhood MDT coordination events</li>
              <li>Remote monitoring with proactive alerting</li>
            </ul>
          </article>
          <article className="card">
            <h2>AgentMail &amp; TIP-20</h2>
            <p>
              Wallet-paid email via the API and on-chain TIP-20 creation (viem factory) — surfaced here for the NHS shell.
            </p>
            <div className="actions">
              <a className="secondary button-like" href="/nhs/agentmail">
                AgentMail
              </a>
              <a className="secondary button-like" href="/nhs/tip20">
                TIP-20
              </a>
            </div>
          </article>
          <article className="card">
            <h2>Stripe purl (agents &amp; CLI)</h2>
            <p>
              Try the official <a href="https://www.purl.dev/">purl.dev</a> <strong>free</strong> and <strong>paid</strong>{' '}
              test endpoints — same mental model as HTTP + <code>402</code> before you wire Tempo MPP NHS APIs.
            </p>
            <p className="note">
              Paid demo uses Stripe’s hosted test (0.01 USDC). Tempo NHS routes are documented separately in{' '}
              <code>docs/PURL_CLINICAL_TEMPO.md</code>.
            </p>
            <div className="actions">
              <a className="secondary button-like" href="/nhs/purl">
                Open purl use case
              </a>
            </div>
          </article>
          <article className="card">
            <h2>Open Wallet Standard (OWS)</h2>
            <p>
              Install the official <code>ows</code> CLI from{' '}
              <a href="https://docs.openwallet.sh/install.sh" target="_blank" rel="noreferrer">
                docs.openwallet.sh/install.sh
              </a>{' '}
              — prebuilt binary or build from source, optional Python/Node bindings, and agent skills for supported IDEs.
            </p>
            <div className="actions">
              <a className="secondary button-like" href="/nhs/ows">
                Open OWS use case
              </a>
            </div>
          </article>
        </section>
      )}
    </NhsShell>
  )
}

