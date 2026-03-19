import { useState } from 'react'
import './App.css'

export default function SocialApp() {
  const [username, setUsername] = useState('nike')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'triggered' | 'polling' | 'finished' | 'error'>('idle')
  const [summary, setSummary] = useState('—')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([
    'StableSocial dashboard initialized. Trigger a scrape and poll via token.',
  ])

  const pushLog = (entry: string) => setLog((prev) => [entry, ...prev].slice(0, 12))

  const parseResponse = async (res: Response) => {
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }
    return { data, raw }
  }

  const trigger = async () => {
    setLoading(true)
    setError('')
    setStatus('idle')
    try {
      const res = await fetch('/api/social/stablesocial/instagram-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'StableSocial trigger failed')
      const t = data?.result?.token || data?.token || ''
      setToken(t)
      setStatus('triggered')
      setSummary(t ? 'Token received. Ready to poll.' : 'Triggered (no token returned).')
      pushLog('Triggered StableSocial scrape.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('error')
      setError(message)
      pushLog(`Trigger failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const pollOnce = async (overrideToken?: string) => {
    const t = (overrideToken ?? token).trim()
    if (!t) return
    setLoading(true)
    setError('')
    setStatus('polling')
    try {
      const res = await fetch(`/api/social/stablesocial/jobs?token=${encodeURIComponent(t)}`)
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'StableSocial poll failed')
      const s = data?.result?.status || data?.status || 'unknown'
      setSummary(`Job status: ${s}`)
      pushLog(`Polled job status: ${s}`)
      if (s === 'finished') setStatus('finished')
      else setStatus('polling')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('error')
      setError(message)
      pushLog(`Poll failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const pollUntilFinished = async () => {
    const t = token.trim()
    if (!t || loading) return
    setError('')
    setStatus('polling')
    setLoading(true)
    try {
      const attempts = 12
      for (let i = 0; i < attempts; i += 1) {
        const res = await fetch(`/api/social/stablesocial/jobs?token=${encodeURIComponent(t)}`)
        const { data, raw } = await parseResponse(res)
        if (!res.ok) throw new Error(data?.error || data?.details || raw || 'StableSocial poll failed')
        const s = data?.result?.status || data?.status || 'unknown'
        setSummary(`Job status: ${s}`)
        pushLog(`Poll ${i + 1}/${attempts}: ${s}`)
        if (s === 'finished') {
          setStatus('finished')
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('error')
      setError(message)
      pushLog(`Auto-poll failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Social Ops Dashboard</h1>
        <p>Dedicated StableSocial trigger + token polling test page.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Trigger scrape</h2>
          <div className="field-grid">
            <label>
              Instagram username
              <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading} />
            </label>
            <label>
              Job token
              <input value={token} onChange={(e) => setToken(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={trigger} disabled={loading}>
              {loading ? 'Working...' : 'Trigger StableSocial'}
            </button>
            <button className="secondary" onClick={() => pollOnce()} disabled={loading || !token.trim()}>
              Poll once
            </button>
            <button className="secondary" onClick={pollUntilFinished} disabled={loading || !token.trim()}>
              Poll until finished
            </button>
          </div>
        </article>

        <article className="card">
          <h3>Telemetry</h3>
          <ul className="meta">
            <li>
              <span>Status</span>
              <strong>{status}</strong>
            </li>
            <li>
              <span>Summary</span>
              <strong>{summary}</strong>
            </li>
          </ul>
          {error ? <p className="error">{error}</p> : null}
          <h4>Latest actions</h4>
          <ul className="log">
            {log.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card api">
        <h3>StableSocial API Contract</h3>
        <div className="api-list">
          <code>POST /api/social/stablesocial/instagram-profile</code>
          <code>GET /api/social/stablesocial/jobs?token=...</code>
        </div>
      </section>
    </main>
  )
}

