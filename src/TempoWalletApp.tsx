import { useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { DocCodeBlock, DocPageNav } from './components/DocCodeBlock'
import {
  DanceExtrasJudgeWireBrowserPanel,
  DanceExtrasJudgeWireNetworkChrome,
} from './components/DanceExtrasJudgeWireTools'
import { buildCurlJudgeWire, buildTempoRequestLocal } from './danceExtrasJudgeWire'
import type { TempoHubNetwork } from './danceExtrasLiveMpp'

/**
 * Showcase for the official Tempo Wallet CLI — https://github.com/tempoxyz/wallet
 * Complements in-browser MetaMask/mppx flows with passkey-based CLI + `tempo request`.
 */

const INSTALL = `curl -fsSL https://tempo.xyz/install | bash`

const TEMPO_CATALOG = `# Preview cost
tempo request --dry-run \\
  "https://aviationstack.mpp.tempo.xyz/v1/flights?flight_iata=AA100"

# Execute
tempo request \\
  "https://aviationstack.mpp.tempo.xyz/v1/flights?flight_iata=AA100"`

const TEMPO_PANEL_ID = 'tempo-wallet-wire-panel'

export default function TempoWalletApp() {
  const [network, setNetwork] = useState<TempoHubNetwork>('testnet')

  const tempoBrowserLede: ReactNode = (
    <>
      Same <code>POST</code> you use with <code>tempo request</code> after <code>tempo wallet login</code>.{' '}
      <strong>Wire check</strong> uses plain <code>fetch</code> (expect <code>402</code>).{' '}
      <strong>Pay with browser wallet</strong> uses <code>mppx</code> + MetaMask like{' '}
      <a href="/dance-extras">/dance-extras</a> — not the Tempo CLI binary.
    </>
  )

  return (
    <main className="app app-cli-docs">
      <header className="hero">
        <h1>Tempo Wallet CLI</h1>
        <p>
          The official Tempo Wallet is a command-line wallet and HTTP client for{' '}
          <a href="https://tempo.xyz" target="_blank" rel="noreferrer">
            Tempo
          </a>{' '}
          with built-in Machine Payments Protocol (MPP) support — handle{' '}
          <code>402 Payment Required</code> in one command. Open source:{' '}
          <a href="https://github.com/tempoxyz/wallet" target="_blank" rel="noreferrer">
            github.com/tempoxyz/wallet
          </a>
          .
        </p>
        <DocPageNav
          links={[
            { href: '/', label: '← Hub' },
            { href: '/dance-extras', label: '/dance-extras', hint: 'Browser MPP' },
            { href: '/purl', label: 'Stripe purl', hint: 'curl + purl wire' },
          ]}
        />
        <p className="doc-prose-muted" style={{ marginTop: '0.85rem' }}>
          Long-form log: <code>docs/TEMPO_WALLET_TEST.md</code> in the repo.
        </p>
      </header>

      <section
        className="card"
        style={{
          borderLeft: `4px solid ${network === 'testnet' ? '#22c55e' : '#dc2626'}`,
          background:
            network === 'testnet'
              ? 'linear-gradient(90deg, #f0fdf4 0%, #fff 12%)'
              : 'linear-gradient(90deg, #fef2f2 0%, #fff 12%)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Does it work? (verified)</h2>
        <p className="doc-prose-muted">
          With <code>npm run server</code> on port <strong>8787</strong>, the DanceTempo live route returns{' '}
          <strong>402 Payment Required</strong> — same as the browser. Pick testnet or mainnet, then use 1-click checks
          or copy the curl for your terminal.
        </p>

        <DanceExtrasJudgeWireNetworkChrome network={network} onNetwork={setNetwork} panelId={TEMPO_PANEL_ID} />

        <div
          id={TEMPO_PANEL_ID}
          role="tabpanel"
          aria-labelledby={
            network === 'testnet' ? `${TEMPO_PANEL_ID}-tab-testnet` : `${TEMPO_PANEL_ID}-tab-mainnet`
          }
        >
          <DanceExtrasJudgeWireBrowserPanel network={network} lede={tempoBrowserLede} />

          <p className="doc-prose-muted" style={{ marginTop: '1rem' }}>
            <strong>Expected (wire check):</strong> <code>402</code> and JSON with payment challenge. The official{' '}
            <code>tempo request --dry-run</code> before <code>tempo wallet login</code> returns{' '}
            <code>No key configured for network &apos;tempo-moderato&apos;</code> on testnet — full log:{' '}
            <a href="https://github.com/arunnadarasa/dancetempo/blob/main/docs/TEMPO_WALLET_TEST.md">
              docs/TEMPO_WALLET_TEST.md
            </a>
            .
          </p>

          <h3 style={{ marginTop: '1.25rem' }}>curl (terminal)</h3>
          <DocCodeBlock label="curl" code={buildCurlJudgeWire(network)} />
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Why show this in DanceTempo?</h2>
        <p className="doc-prose-muted">
          DanceTech Protocol is the same pay-for-HTTP story everywhere: browser (<code>mppx</code>), CLI tools, and
          agents. Tempo Wallet uses passkey login (<code>tempo wallet login</code>) and scoped session keys — a
          first-class alternative to MetaMask for terminal and automation workflows.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Install</h2>
        <p className="doc-prose-muted">From the upstream README — installs the <code>tempo</code> launcher:</p>
        <DocCodeBlock label="bash" code={INSTALL} />
        <p className="intent">
          Optional global skill (from their repo):{' '}
          <code>npx skills@latest add tempoxyz/wallet --global</code>
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Log in &amp; fund (testnet)</h2>
        <ol>
          <li>
            <code>tempo wallet login</code> — opens browser for passkey auth at <code>wallet.tempo.xyz</code>.
          </li>
          <li>
            <code>tempo wallet whoami</code> — verify session.
          </li>
          <li>
            <code>tempo wallet fund</code> — faucet / top-up on testnet as documented upstream.
          </li>
        </ol>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>
          One-shot <code>tempo request</code> (catalog MPP)
        </h2>
        <p className="doc-prose-muted">Example from Tempo Wallet docs — paid API without API keys:</p>
        <DocCodeBlock label="bash" code={TEMPO_CATALOG} />
      </section>

      <section
        className="card"
        style={{
          borderLeft: `4px solid ${network === 'testnet' ? '#6366f1' : '#dc2626'}`,
          background:
            network === 'testnet'
              ? 'linear-gradient(90deg, #eef2ff 0%, #fff 10%)'
              : 'linear-gradient(90deg, #fef2f2 0%, #fff 10%)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>DanceTempo API (local)</h2>
        <p className="doc-prose-muted">
          With <code>npm run server</code> (default <strong>port 8787</strong>), point <strong>tempo request</strong> at
          the same live MPP route for the network selected above — matches the browser 1-click pay and{' '}
          <a href="/purl">/purl</a> wire.
        </p>
        <p className="doc-prose-muted">
          Network for snippets: <strong>{network === 'testnet' ? 'testnet (42431)' : 'mainnet (4217)'}</strong>. Switch
          tabs in <strong>Does it work?</strong> to update this block.
        </p>
        <DocCodeBlock label="bash" code={buildTempoRequestLocal(network)} />
        <p className="intent">
          Requires <code>MPP_SECRET_KEY</code> and <code>MPP_RECIPIENT</code> on the server — same as browser live mode.
          Use testnet first.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Session-based requests</h2>
        <p className="doc-prose-muted">
          Tempo Wallet supports session / channel payments for streaming and repeat calls (e.g.{' '}
          <code>openrouter.mpp.tempo.xyz</code>). See the{' '}
          <a href="https://github.com/tempoxyz/wallet#session-payment-channel" target="_blank" rel="noreferrer">
            Session Payment section
          </a>{' '}
          in the upstream README.
        </p>
      </section>

      <section className="card api">
        <h3>References</h3>
        <div className="api-list">
          <a href="https://github.com/tempoxyz/wallet">tempoxyz/wallet (GitHub)</a>
          <a href="https://tempo.xyz">tempo.xyz</a>
          <a href="https://mpp.dev">mpp.dev</a>
          <a href="https://github.com/arunnadarasa/dancetempo">DanceTempo (this repo)</a>
        </div>
      </section>
    </main>
  )
}
