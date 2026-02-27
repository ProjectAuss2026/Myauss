import { useState } from 'react'
import './App.css'
import LinktreeTest from './components/LinktreeTest'

function App() {
  const [page, setPage] = useState('home')
  const [testResult, setTestResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const testBackend = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/test', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await response.json()
      setTestResult(data)
    } catch (error) {
      setTestResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {page === 'linktree' && <LinktreeTest onBack={() => setPage('home')} />}
      {page === 'home' && (
        <div className="page">
          <header className="hero">
            <div className="hero-content">
              <span className="badge">AUSS</span>
              <h1>Auckland Uni Strength Society</h1>
              <p>
                AUSS connects members with club events, registration links, and
                strength community updates in one place.
              </p>
              <div className="cta-row">
                <button className="primary">Get Started</button>
                <button className="secondary">Learn More</button>
                <button className="secondary" onClick={testBackend} disabled={loading}>
                  {loading ? 'Testing...' : 'Test Backend'}
                </button>
                <button className="secondary" onClick={() => setPage('linktree')}>
                  Linktree Test
                </button>
              </div>
              {testResult && (
                <div className="test-result">
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </header>

          <section className="features">
            <div className="feature-card">
              <h3>Upcoming Events</h3>
              <p>See the latest training sessions, workshops, and meets.</p>
            </div>
            <div className="feature-card">
              <h3>Registration Links</h3>
              <p>Quick access to event sign-ups and membership forms.</p>
            </div>
            <div className="feature-card">
              <h3>Community Updates</h3>
              <p>Announcements, socials, and important club news.</p>
            </div>
          </section>

          <section className="info">
            <div>
              <h2>Built for the AUSS community</h2>
              <p>
                Centralize event info, keep members in the loop, and make
                registrations easy.
              </p>
            </div>
            <div className="info-panel">
              <div>
                <span className="label">Version</span>
                <strong>v1.0</strong>
              </div>
              <div>
                <span className="label">Status</span>
                <strong>Active</strong>
              </div>
              <div>
                <span className="label">Backend</span>
                <strong>Node + Prisma</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default App
