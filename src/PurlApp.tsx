import { useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { DocCodeBlock, DocPageNav } from './components/DocCodeBlock'
import {
  DanceExtrasJudgeWireBrowserPanel,
  DanceExtrasJudgeWireNetworkChrome,
} from './components/DanceExtrasJudgeWireTools'
import { buildCurlJudgeWire, buildPurlDryRun, buildPurlLive } from './danceExtrasJudgeWire'
import type { TempoHubNetwork } from './danceExtrasLiveMpp'

const PURL_PANEL_ID = 'purl-wire-panel'

/**
 * Dedicated Stripe purl showcase — https://github.com/stripe/purl
 * Real wire examples for Tempo testnet + mainnet against DanceTempo live MPP routes.
 */
export default function PurlApp() {
  const [network, setNetwork] = useState<TempoHubNetwork>('testnet')

  const purlLede: ReactNode = (
    <>
      Same endpoints as the CLI: <strong>Wire check</strong> uses plain <code>fetch</code> (expect <code>402</code> —
      no wallet). <strong>Pay with browser wallet</strong> uses the same Tempo MPP client as{' '}
      <a href="/dance-extras">/dance-extras</a> live mode (not the <code>purl</code> binary).
    </>
  )

  return (
    <main className="app app-cli-docs">
      <header className="hero">
        <h1>Stripe purl + DanceTempo</h1>
        <p>
          <strong>purl</strong> is a curl-like CLI for HTTP that requires payment — built for humans and agents (
          <a href="https://github.com/stripe/purl" target="_blank" rel="noreferrer">
            github.com/stripe/purl
          </a>
          ). Use the tabs below to switch between testnet and mainnet wire examples; each hits{' '}
          <code>POST /api/dance-extras/live/:flowKey/:network</code> like the browser on{' '}
          <a href="/dance-extras">/dance-extras</a>.
        </p>
        <DocPageNav
          links={[
            { href: '/', label: '← Hub' },
            { href: '/dance-extras', label: '/dance-extras' },
            { href: '/tempo-wallet', label: 'Tempo Wallet CLI' },
          ]}
        />
        <p className="doc-prose-muted" style={{ marginTop: '0.85rem' }}>
          Long-form notes: <code>docs/PURL_DANCETEMPO.md</code> (repo root).
        </p>
      </header>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Prerequisites</h2>
        <ul className="doc-prose-muted">
          <li>
            <code>npm run server</code> on <strong>port 8787</strong> (or set <code>PORT</code> and replace URLs).
          </li>
          <li>
            <code>purl</code> — <code>brew install stripe/purl/purl</code> or <code>cargo install --path cli</code> from
            the purl repo.
          </li>
          <li>
            Tempo wallet in purl: <code>purl wallet add --type tempo …</code> — use a dedicated key; test on testnet
            first.
          </li>
          <li>
            Server: <code>MPP_SECRET_KEY</code>, <code>MPP_RECIPIENT</code> (see <code>.env.example</code>).
          </li>
        </ul>
      </section>

      <section
        className="card"
        style={{
          borderLeft: `4px solid ${network === 'testnet' ? '#3b82f6' : '#dc2626'}`,
          background:
            network === 'testnet'
              ? 'linear-gradient(90deg, #eff6ff 0%, #fff 10%)'
              : 'linear-gradient(90deg, #fef2f2 0%, #fff 10%)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Live MPP wire</h2>
        <p className="doc-prose-muted" id="purl-network-hint">
          Choose network — commands update below. Testnet first; mainnet spends real assets.
        </p>

        <DanceExtrasJudgeWireNetworkChrome network={network} onNetwork={setNetwork} panelId={PURL_PANEL_ID} />

        <div
          id={PURL_PANEL_ID}
          role="tabpanel"
          aria-labelledby={network === 'testnet' ? `${PURL_PANEL_ID}-tab-testnet` : `${PURL_PANEL_ID}-tab-mainnet`}
        >
          <DanceExtrasJudgeWireBrowserPanel network={network} lede={purlLede} />

          <h3>1) Wire check (no wallet)</h3>
          <DocCodeBlock label="curl" code={buildCurlJudgeWire(network)} />

          <h3>2) purl dry-run (parse MPP, no tx)</h3>
          <DocCodeBlock label="bash" code={buildPurlDryRun(network)} />

          <h3>3) purl live pay</h3>
          <DocCodeBlock label="bash" code={buildPurlLive(network)} />
          <p className="doc-prose-muted">
            {network === 'testnet' ? (
              <>
                Requires funded <strong>testnet</strong> balance. Omit <code>--confirm</code> for a non-interactive flow.
              </>
            ) : (
              <>
                Your purl Tempo wallet must hold <strong>mainnet</strong> funds. Double-check{' '}
                <code>MPP_RECIPIENT</code> on the server.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Other flow keys</h2>
        <p className="doc-prose-muted">
          Replace <code>judge-score</code> with: <code>cypher-micropot</code>, <code>clip-sale</code>,{' '}
          <code>reputation</code>, <code>ai-usage</code>, <code>bot-action</code>, <code>fan-pass</code> — same URL
          pattern: <code>/api/dance-extras/live/&lt;flowKey&gt;/testnet</code> or <code>/mainnet</code>. Body shapes live
          in <code>executeDanceExtraFlow</code> in <code>server/index.js</code>.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          Why not <code>purl inspect</code>?
        </h2>
        <p className="doc-prose-muted">
          <code>purl inspect</code> uses GET. DanceTempo live routes are POST-only, so inspect gets 404. Use{' '}
          <code>purl --dry-run -X POST --json</code> instead.
        </p>
      </section>
    </main>
  )
}
