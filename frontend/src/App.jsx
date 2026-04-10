import { useState, useEffect } from 'react'

function App() {
  const [events, setEvents] = useState([])
  const [token, setToken] = useState(null)
  const [username, setUsername] = useState('loc_admin')
  const [password, setPassword] = useState('MySecurePassword123')
  const [queueStatus, setQueueStatus] = useState(null)
  const [message, setMessage] = useState('')

  // 1. Fetch Events on Load
  useEffect(() => {
    fetch('/api/events/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error("Failed to fetch events:", err))
  }, [])

  // 2. Login Flow
  const handleLogin = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await res.json()
    if (res.ok) {
      setToken(data.token)
      setMessage('✅ Logged in successfully!')
    } else {
      setMessage('❌ Login failed: ' + data.error)
    }
  }

  // 3. Join Waiting Room Flow
  const joinQueue = async () => {
    const res = await fetch('/api/queue/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: username })
    })
    const data = await res.json()
    if (res.ok) {
      setQueueStatus('In Queue')
      setMessage('⏳ Joined the waiting room!')
    } else {
      setMessage('❌ Failed to join queue')
    }
  }

  // 4. Book Ticket Flow
  const bookTicket = async (eventId) => {
    if (!token) {
      setMessage('❌ You must log in first!')
      return
    }
    
    setMessage('Processing booking...')
    const res = await fetch('/api/booking/book', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      // Hardcoding ticket_id for the example based on the eventId
      body: JSON.stringify({ user_id: username, ticket_id: eventId === 1 ? 1 : 4 }) 
    })
    
    const data = await res.json()
    if (res.ok) {
      setMessage(`🎉 SUCCESS: ${data.message} (Ticket ID: ${data.ticket_id})`)
    } else {
      setMessage(`❌ BOOKING FAILED: ${data.error}`)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎟️ FlashTicket Portal</h1>
      
      {/* Status Message Bar */}
      {message && <div style={{ padding: '10px', background: '#eee', marginBottom: '20px' }}><strong>Status:</strong> {message}</div>}

      {/* Login Section */}
      {!token ? (
        <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
          <h2>1. Login</h2>
          <form onSubmit={handleLogin}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={{ marginRight: '10px' }}/>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ marginRight: '10px' }}/>
            <button type="submit">Login</button>
          </form>
        </div>
      ) : (
        <div style={{ border: '1px solid green', padding: '20px', marginBottom: '20px' }}>
          <h2>✅ Authenticated as {username}</h2>
          {!queueStatus ? (
            <button onClick={joinQueue} style={{ background: 'orange', padding: '10px' }}>Join Waiting Room</button>
          ) : (
            <p><strong>Queue Status:</strong> {queueStatus} (You may now book tickets)</p>
          )}
        </div>
      )}

      {/* Events Section */}
      <h2>2. Available Events</h2>
      <div style={{ display: 'grid', gap: '10px' }}>
        {events.map(event => (
          <div key={event.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
            <h3>{event.name}</h3>
            <p>📅 {event.date} | 📍 {event.location}</p>
            <button 
              onClick={() => bookTicket(event.id)}
              disabled={!queueStatus}
              style={{ background: queueStatus ? '#007bff' : '#ccc', color: 'white', padding: '10px', border: 'none', cursor: queueStatus ? 'pointer' : 'not-allowed' }}
            >
              Book Ticket
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App