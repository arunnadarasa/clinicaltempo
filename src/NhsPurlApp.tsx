import NhsShell from './NhsShell'
import { DocCodeBlock } from './components/DocCodeBlock'

const PURL_HOME = 'https://www.purl.dev/'
const PURL_FREE = 'https://www.purl.dev/test/free'
const PURL_PAID = 'https://www.purl.dev/test/paid'
const PURL_INSTALL_SH = 'curl -fsSL https://www.purl.dev/install.sh | bash'

const installBrew = `brew install stripe/purl/purl`

const installScript = PURL_INSTALL_SH

const walletAdd = `purl wallet add`

const freeCmd = `purl ${PURL_FREE}`

const paidCmd = `purl ${PURL_PAID}`

const paidDryRun = `purl --dry-run ${PURL_PAID}`

const purlBalance = `purl balance`

const tempoPaidPost = `purl -X POST https://climate.stripe.dev/api/contribute \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 7}'`

const purlDevPaidReal = `purl https://www.purl.dev/test/paid`

const danceExtrasJudgeTestnetReal = `BODY='{"network":"testnet","battleId":"b","roundId":"r","judgeId":"j","dancerId":"d","score":9}'
purl -X POST --json "$BODY" \\
  "http://127.0.0.1:8787/api/dance-extras/live/judge-score/testnet"`

const danceExtrasJudgeMainnetReal = `BODY='{"network":"mainnet","battleId":"b","roundId":"r","judgeId":"j","dancerId":"d","score":9}'
purl -X POST --json "$BODY" \\
  "http://127.0.0.1:8787/api/dance-extras/live/judge-score/mainnet"`

const nhsGpAccessTestnetReal = `export WALLET=0xYOUR_WALLET_HERE
BODY='{"network":"testnet","walletAddress":"'"$WALLET"'","role":"patient","requestText":"purl on-chain smoke test","priority":"routine"}'
purl -H "X-Wallet-Address: $WALLET" -H "X-User-Role: patient" -X POST --json "$BODY" \\
  "http://127.0.0.1:8787/api/nhs/gp-access/requests"`

const nhsGpAccessMainnetReal = `export WALLET=0xYOUR_WALLET_HERE
BODY='{"network":"mainnet","walletAddress":"'"$WALLET"'","role":"patient","requestText":"purl on-chain smoke test","priority":"routine"}'
purl -H "X-Wallet-Address: $WALLET" -H "X-User-Role: patient" -X POST --json "$BODY" \\
  "http://127.0.0.1:8787/api/nhs/gp-access/requests"`

const PURL_GH = 'https://github.com/stripe/purl'

export default function NhsPurlApp() {
  return (
    <NhsShell
      title="Stripe purl — NHS hackathon use case"
      subtitle={
        'purl supports Tempo and MPP (plus x402). Use balance + paid HTTP examples here, purl.dev smoke tests below, then local NHS MPP routes per docs/PURL_CLINICAL_TEMPO.md.'
      }
    >
      {() => (
        <section className="grid">
          <article className="card">
            <h2>What is purl?</h2>
            <p>
              <a href={PURL_HOME} target="_blank" rel="noreferrer">
                purl
              </a>{' '}
              is a <em>curl</em>-style CLI for requests that may require payment — <em>payments + curl = purl</em> — built by{' '}
              <strong>Stripe</strong>, for humans and AI agents. It parses <code>402</code> challenges and can complete{' '}
              <strong>MPP</strong> on <strong>Tempo</strong> (mainnet and Moderato testnet), not only generic x402 flows.
            </p>
            <p className="note">
              Source and releases:{' '}
              <a href={PURL_GH} target="_blank" rel="noreferrer">
                stripe/purl
              </a>{' '}
              (Homebrew: <code>brew install stripe/purl/purl</code>). The <strong>purl.dev</strong> URLs further down are
              Stripe-hosted smoke tests; your Tempo wallet balances show up under <code>purl balance</code>.
            </p>
          </article>

          <article className="card">
            <h2>Tempo + MPP (native)</h2>
            <p>
              With a Tempo wallet configured in <code>purl</code>, <code>purl balance</code> lists networks such as{' '}
              <code>tempo</code> (e.g. USDC) and <code>tempo-moderato</code> (e.g. pathUSD). Use that to confirm funds before
              paid calls.
            </p>
            <DocCodeBlock label="bash" code={purlBalance} />
            <p>
              Example <strong>paid</strong> POST (wallet pays via the same payment model purl uses for MPP/x402 — here Stripe
              Climate):
            </p>
            <DocCodeBlock label="bash" code={tempoPaidPost} />
            <p className="intent">
              NHS APIs in this repo: after <code>purl</code> works with Tempo, use <code>docs/PURL_CLINICAL_TEMPO.md</code> for{' '}
              <code>purl --dry-run -X POST</code> against <code>http://127.0.0.1:8787/api/nhs/...</code> with MPP.
            </p>
          </article>

          <article className="card">
            <h2>Real on-chain payment (omit <code>--dry-run</code>)</h2>
            <p>
              These commands <strong>broadcast</strong> Tempo / MPP payments when a <code>402</code> challenge is returned.
              Run <code>purl balance</code> first, use a <strong>test wallet</strong>, and prefer <strong>testnet</strong>{' '}
              until you intend to spend real USDC on mainnet.
            </p>
            <p className="note">
              Add <code>--confirm</code> if your <code>purl</code> build supports an extra confirmation step.
            </p>

            <h3 style={{ marginTop: '0.85rem', fontSize: '1.05rem' }}>Stripe Climate (live)</h3>
            <p>Same POST as above — no dry-run flag.</p>
            <DocCodeBlock label="bash" code={tempoPaidPost} />

            <h3 style={{ marginTop: '0.85rem', fontSize: '1.05rem' }}>purl.dev paid smoke (live)</h3>
            <DocCodeBlock label="bash" code={purlDevPaidReal} />

            <h3 style={{ marginTop: '0.85rem', fontSize: '1.05rem' }}>Clinical Tempo API — judge score (local server)</h3>
            <p>
              Requires <code>npm run server</code> on <code>127.0.0.1:8787</code> and <code>MPP_RECIPIENT</code> / MPP config.
              See <code>docs/PURL_CLINICAL_TEMPO.md</code> §4.
            </p>
            <p className="intent">
              <strong>Testnet (42431)</strong>
            </p>
            <DocCodeBlock label="bash" code={danceExtrasJudgeTestnetReal} />
            <p className="intent">
              <strong>Mainnet (4217)</strong> — real funds
            </p>
            <DocCodeBlock label="bash" code={danceExtrasJudgeMainnetReal} />

            <h3 style={{ marginTop: '0.85rem', fontSize: '1.05rem' }}>NHS GP access (local MPP gate)</h3>
            <p>
              Replace <code>WALLET</code> with the same address as your <code>purl</code> Tempo keystore. Body must include{' '}
              <code>network</code> for the payment gate. Server: <code>npm run dev:full</code> or <code>npm run server</code>.
            </p>
            <p className="intent">
              <strong>Testnet</strong>
            </p>
            <DocCodeBlock label="bash" code={nhsGpAccessTestnetReal} />
            <p className="intent">
              <strong>Mainnet</strong>
            </p>
            <DocCodeBlock label="bash" code={nhsGpAccessMainnetReal} />
          </article>

          <article className="card">
            <h2>Install</h2>
            <p>From the homepage: Homebrew or shell script.</p>
            <DocCodeBlock label="brew" code={installBrew} />
            <DocCodeBlock label="sh" code={installScript} />
          </article>

          <article className="card">
            <h2>Wallet setup</h2>
            <p>
              Required before paid calls. For <strong>Tempo</strong>, use a Tempo keystore in <code>purl</code> (see{' '}
              <code>docs/PURL_CLINICAL_TEMPO.md</code> for <code>purl wallet add --type tempo</code>).
            </p>
            <DocCodeBlock label="bash" code={walletAdd} />
          </article>

          <article className="card">
            <h2>Free endpoint (no payment)</h2>
            <p>
              <a href={PURL_FREE} target="_blank" rel="noreferrer">
                {PURL_FREE}
              </a>
            </p>
            <DocCodeBlock label="bash" code={freeCmd} />
            <p className="note">Quick sanity check; unrelated to Tempo chain state.</p>
          </article>

          <article className="card">
            <h2>Paid endpoint (0.01 USDC)</h2>
            <p>
              <a href={PURL_PAID} target="_blank" rel="noreferrer">
                {PURL_PAID}
              </a>{' '}
              — exercises the payment path (see{' '}
              <a href={PURL_HOME} target="_blank" rel="noreferrer">
                purl.dev
              </a>
              ).
            </p>
            <DocCodeBlock label="bash" code={paidDryRun} />
            <p className="note">Dry-run shows what would be paid without broadcasting a transaction.</p>
            <DocCodeBlock label="bash" code={paidCmd} />
            <p className="note">Hosted demo on purl.dev; contrast with <code>purl balance</code> + Tempo MPP above.</p>
          </article>

          <article className="card">
            <h2>Next: this repo’s NHS API</h2>
            <p>
              In-browser flows use MetaMask (etc.); <code>purl</code> is for CLI/agents. NHS routes use <strong>Tempo MPP</strong>{' '}
              on <code>localhost:8787</code>. Follow <code>docs/PURL_CLINICAL_TEMPO.md</code> for <code>purl --dry-run</code> and
              live POSTs to <code>/api/nhs/*</code> on <strong>Tempo testnet</strong>.
            </p>
            <p className="intent">
              Long-form: <code>docs/PURL_NHS.md</code> and <code>docs/PURL_CLINICAL_TEMPO.md</code>.
            </p>
          </article>
        </section>
      )}
    </NhsShell>
  )
}
