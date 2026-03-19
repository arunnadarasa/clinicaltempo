import { useState } from 'react'
import './App.css'

const shortValue = (value: string, keep = 34) => {
  if (!value) return value
  if (value.length <= keep) return value
  return `${value.slice(0, keep)}...`
}

export default function TravelApp() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([
    'Travel ops dashboard initialized. Run StableTravel, Aviationstack, or Google Maps checks.',
  ])

  const [origin, setOrigin] = useState('JFK')
  const [destination, setDestination] = useState('LAX')
  const [departureDate, setDepartureDate] = useState('2026-07-10')
  const [stableSummary, setStableSummary] = useState('—')

  const [flightIata, setFlightIata] = useState('AA100')
  const [flightStatus, setFlightStatus] = useState('active')
  const [aviationSummary, setAviationSummary] = useState('—')

  const [address, setAddress] = useState('1600 Amphitheatre Parkway, Mountain View, CA')
  const [mapsSummary, setMapsSummary] = useState('—')

  const pushLog = (entry: string) => setLog((prev) => [entry, ...prev].slice(0, 12))

  const parseResponse = async (res: Response) => {
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    return { data, text }
  }

  const runStableTravel = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/travel/stable/flights-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originLocationCode: origin,
          destinationLocationCode: destination,
          departureDate,
          adults: 1,
          max: 3,
        }),
      })
      const { data, text } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || text || 'StableTravel request failed')
      const offers = Array.isArray(data?.result?.data) ? data.result.data.length : 0
      setStableSummary(`Offers: ${offers}`)
      pushLog(`StableTravel query succeeded (${origin} -> ${destination}).`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`StableTravel query failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const runAviationstack = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/travel/aviationstack/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flight_iata: flightIata, flight_status: flightStatus, limit: 3 }),
      })
      const { data, text } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || text || 'Aviationstack request failed')
      const flights = Array.isArray(data?.result?.data) ? data.result.data.length : 0
      setAviationSummary(`Flights: ${flights}`)
      pushLog(`Aviationstack lookup succeeded (${flightIata}).`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`Aviationstack lookup failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const runGoogleMaps = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/travel/googlemaps/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const { data, text } = await parseResponse(res)
      if (!res.ok) throw new Error(data?.error || data?.details || text || 'Google Maps request failed')
      const first = Array.isArray(data?.result?.results) ? data.result.results[0] : null
      const location = first?.geometry?.location
      if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
        setMapsSummary(`Coordinates: ${location.lat}, ${location.lng}`)
      } else {
        const count = Array.isArray(data?.result?.results) ? data.result.results.length : 0
        setMapsSummary(`Results: ${count}`)
      }
      pushLog('Google Maps geocode succeeded.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      pushLog(`Google Maps geocode failed: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Travel Ops Dashboard</h1>
        <p>Dedicated testing page for StableTravel, Aviationstack, and Google Maps integrations.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h3>StableTravel Search</h3>
          <div className="field-grid">
            <label>
              Origin (IATA)
              <input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} disabled={loading} />
            </label>
            <label>
              Destination (IATA)
              <input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} disabled={loading} />
            </label>
            <label>
              Departure date
              <input value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={runStableTravel} disabled={loading}>
              {loading ? 'Querying...' : 'Run StableTravel'}
            </button>
          </div>
          <p className="intent">Result: <strong>{stableSummary}</strong></p>
        </article>

        <article className="card">
          <h3>Aviationstack Tracking</h3>
          <div className="field-grid">
            <label>
              Flight IATA
              <input value={flightIata} onChange={(e) => setFlightIata(e.target.value.toUpperCase())} disabled={loading} />
            </label>
            <label>
              Status filter
              <input value={flightStatus} onChange={(e) => setFlightStatus(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={runAviationstack} disabled={loading}>
              {loading ? 'Querying...' : 'Run Aviationstack'}
            </button>
          </div>
          <p className="intent">Result: <strong>{aviationSummary}</strong></p>
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <h3>Google Maps Geocode</h3>
          <div className="field-grid">
            <label>
              Address
              <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading} />
            </label>
          </div>
          <div className="actions">
            <button onClick={runGoogleMaps} disabled={loading}>
              {loading ? 'Querying...' : 'Run Google Maps'}
            </button>
          </div>
          <p className="intent">Result: <strong>{mapsSummary}</strong></p>
        </article>

        <article className="card">
          <h3>Latest actions</h3>
          {error ? <p className="error">{error}</p> : null}
          <ul className="log">
            {log.map((entry) => (
              <li key={entry}>{shortValue(entry, 120)}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card api">
        <h3>Travel API Contract</h3>
        <div className="api-list">
          <code>POST /api/travel/stable/flights-search</code>
          <code>POST /api/travel/aviationstack/flights</code>
          <code>POST /api/travel/googlemaps/geocode</code>
        </div>
      </section>
    </main>
  )
}
