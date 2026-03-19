import { useState } from 'react'
import './App.css'

export default function MusicApp() {
  const [prompt, setPrompt] = useState('Aggressive krump battle beat, 100 bpm, dark bass, crowd energy')
  const [style, setStyle] = useState('krump')
  const [duration, setDuration] = useState('30')
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [summary, setSummary] = useState('—')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>(['Music dashboard initialized.'])

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

  const generate = async () => {
    setLoading(true)
    setError('')
    setStatus('idle')
    try {
      const res = await fetch('/api/music/suno/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style,
          duration: Number(duration),
        }),
      })
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'Suno generate failed')

      const id =
        data?.result?.id ||
        data?.result?.track_id ||
        data?.result?.jobId ||
        data?.result?.job_id ||
        null

      setStatus('ok')
      setSummary(id ? `Suno job: ${id}` : 'Suno response received')
      pushLog('Suno generate request succeeded.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setStatus('error')
      setError(message)
      pushLog(`Generate failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Music Dashboard</h1>
        <p>Dedicated Suno integration testing page.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>Suno generate</h2>
          <div className="field-grid">
            <label>
              Prompt
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={loading} />
            </label>
            <label>
              Style
              <input value={style} onChange={(e) => setStyle(e.target.value)} disabled={loading} />
            </label>
            <label>
              Duration (seconds)
              <input value={duration} onChange={(e) => setDuration(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={generate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate with Suno'}
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
        <h3>Music API Contract</h3>
        <div className="api-list">
          <code>POST /api/music/suno/generate</code>
        </div>
      </section>
    </main>
  )
}

