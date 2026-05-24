import { useState } from 'react'
import { parseRoomInput } from '../lib/roomEntry'

interface Props {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
}

export default function HomeScreen({ onCreateRoom, onJoinRoom }: Props) {
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const onJoin = () => {
    const room = parseRoomInput(joinInput)
    if (!room) {
      setJoinError('Paste a share link or enter a room code')
      return
    }
    setJoinError(null)
    onJoinRoom(room)
  }

  return (
    <div className="home-screen">
      <div className="home-screen-glow" aria-hidden="true" />

      <div className="home-screen-inner">
        <header className="home-hero">
          <p className="home-eyebrow">Squad tactics planner</p>
          <h1 className="home-title">
            Comp<span className="text-highlight">Tactic</span>
          </h1>
          <p className="home-lead">
            Open a private room, draw on the map, and brief your squad in real time.
          </p>
        </header>

        <div className="home-actions">
          <button type="button" className="btn btn-primary home-cta" onClick={onCreateRoom}>
            Create room
          </button>
          <p className="home-cta-hint">You become the host — invite others from Members when ready.</p>
        </div>

        <div className="home-join">
          <label htmlFor="join-room" className="home-join-label">
            Join an existing room
          </label>
          <div className="home-join-row">
            <input
              id="join-room"
              type="text"
              value={joinInput}
              onChange={(e) => {
                setJoinInput(e.target.value)
                if (joinError) setJoinError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && onJoin()}
              placeholder="Room link or code…"
              className="input home-join-input"
              autoComplete="off"
            />
            <button type="button" className="btn home-join-btn" onClick={onJoin}>
              Join
            </button>
          </div>
          {joinError && <p className="home-join-error">{joinError}</p>}
        </div>

        <ul className="home-features">
          <li>Live board sync</li>
          <li>Line-up &amp; vehicles</li>
          <li>Private host controls</li>
        </ul>
      </div>

      <span className="site-credit" aria-hidden="true">
        Z1roNNN
      </span>
    </div>
  )
}
