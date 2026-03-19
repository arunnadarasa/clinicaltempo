import { useState } from 'react'
import './App.css'

export default function OpsApp() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([
    'Ops dashboard initialized. Test AgentMail + StablePhone from one place.',
  ])

  const [mailTo, setMailTo] = useState('ops@dancetech.finance')
  const [mailInboxId, setMailInboxId] = useState('') // AgentMail inbox to send FROM
  const [mailSubject, setMailSubject] = useState('Ops Alert Test')
  const [mailText, setMailText] = useState('Call-time reminder: crew call is 6pm sharp.')

  const [phoneNumber, setPhoneNumber] = useState('+14155551234')
  const [callTask, setCallTask] = useState(
    'Call and remind crew call-time is 6pm sharp. Keep it concise and professional.',
  )
  const [voice, setVoice] = useState('natdefault')
  const [callId, setCallId] = useState('')
  const [callStatus, setCallStatus] = useState('—')

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

  const sendEmail = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ops/agentmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_id: mailInboxId, to: mailTo, subject: mailSubject, text: mailText }),
      })
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'AgentMail send failed')
      pushLog(`AgentMail sent to ${mailTo}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`AgentMail failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const startCall = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ops/stablephone/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, task: callTask, voice }),
      })
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'StablePhone call failed')
      const id = data?.result?.call_id || data?.result?.id || data?.result?.callId || ''
      setCallId(id)
      setCallStatus(id ? 'started' : 'unknown')
      pushLog(id ? `StablePhone call started (${id}).` : 'StablePhone call started.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`StablePhone failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const checkCall = async () => {
    if (!callId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ops/stablephone/call/${encodeURIComponent(callId)}`)
      const { data, raw } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || raw || 'StablePhone status failed')
      const s = data?.result?.status || data?.status || 'unknown'
      setCallStatus(s)
      pushLog(`StablePhone status: ${s}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`Status check failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Ops Comms Dashboard</h1>
        <p>Dedicated testing for AgentMail + StablePhone.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>AgentMail</h2>
          <div className="field-grid">
            <label>
              To
              <input value={mailTo} onChange={(e) => setMailTo(e.target.value)} disabled={loading} />
            </label>
            <label>
              Inbox ID (send from)
              <input
                value={mailInboxId}
                onChange={(e) => setMailInboxId(e.target.value)}
                placeholder="e.g. ops@agentmail.to"
                disabled={loading}
              />
            </label>
            <label>
              Subject
              <input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} disabled={loading} />
            </label>
            <label>
              Text
              <input value={mailText} onChange={(e) => setMailText(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={sendEmail} disabled={loading}>
              {loading ? 'Sending...' : 'Send AgentMail'}
            </button>
          </div>
        </article>

        <article className="card">
          <h2>StablePhone</h2>
          <div className="field-grid">
            <label>
              Phone number
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={loading} />
            </label>
            <label>
              Voice
              <input value={voice} onChange={(e) => setVoice(e.target.value)} disabled={loading} />
            </label>
            <label>
              Task
              <input value={callTask} onChange={(e) => setCallTask(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={startCall} disabled={loading}>
              {loading ? 'Working...' : 'Start call'}
            </button>
            <button className="secondary" onClick={checkCall} disabled={loading || !callId}>
              Check status
            </button>
          </div>
          <ul className="meta">
            <li>
              <span>Call ID</span>
              <strong>{callId || '—'}</strong>
            </li>
            <li>
              <span>Status</span>
              <strong>{callStatus}</strong>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <h3>Latest actions</h3>
          {error ? <p className="error">{error}</p> : null}
          <ul className="log">
            {log.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>

        <article className="card api">
          <h3>Ops API Contract</h3>
          <div className="api-list">
            <code>POST /api/ops/agentmail/send</code>
            <code>POST /api/ops/stablephone/call</code>
            <code>GET /api/ops/stablephone/call/:id</code>
          </div>
        </article>
      </section>
    </main>
  )
}

