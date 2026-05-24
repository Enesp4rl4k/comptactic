import { useState } from 'react'
import { parseRoomInput } from '../lib/roomEntry'

interface Props {
  onOpenRoom: () => void
  onJoinRoom: (roomId: string) => void
}

const SQUAD_TAGS = ['AAS', 'RAAS', 'Invasion', 'Skirmish', 'Briefing', 'FOB']

const FEATURES = [
  {
    title: 'Live map sync',
    desc: 'Draw together in real time — pings, zones, and markers.',
    live: true,
  },
  {
    title: 'Squads & vehicles',
    desc: 'Line-up, crew assignments, and tactic sheet export.',
    live: false,
  },
  {
    title: 'Host control',
    desc: 'Private rooms with view-only or editor access per member.',
    live: false,
  },
] as const

export default function HomeScreen({ onOpenRoom, onJoinRoom }: Props) {
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
      <div className="home-fx" aria-hidden="true">
        <div className="home-grid" />
        <div className="home-scan" />
        <div className="home-vignette" />
        <div className="home-corner home-corner-blu" />
        <div className="home-corner home-corner-opf" />
        <div className="home-crosshair">
          <span className="home-crosshair-ring" />
          <span className="home-crosshair-v" />
          <span className="home-crosshair-h" />
        </div>
        <div className="home-compass">N</div>
      </div>

      <div className="home-screen-inner">
        <header className="home-hero">
          <p className="home-eyebrow">
            <span className="home-eyebrow-dot" />
            Squad · live tactics
          </p>
          <h1 className="home-title">
            Comp<span className="text-highlight">Tactic</span>
          </h1>
          <p className="home-lead">
            Plan the attack on the map, build line-ups, and brief your squad — one private room at a time.
          </p>
          <div className="home-tags">
            {SQUAD_TAGS.map((tag) => (
              <span key={tag} className="home-tag">
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="home-layout">
          <section className="home-card home-card-primary">
            <h2 className="home-card-title">Start a session</h2>
            <p className="home-card-desc">Create a room — you are the host and control who can edit.</p>
            <button type="button" className="btn btn-primary home-cta" onClick={onOpenRoom}>
              <span className="home-cta-icon" aria-hidden="true">
                ◈
              </span>
              Open tactic room
            </button>
          </section>

          <section className="home-card">
            <h2 className="home-card-title">Join a room</h2>
            <p className="home-card-desc">Paste an invite link or enter the room code.</p>
            <label htmlFor="join-room" className="sr-only">
              Join existing room
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
          </section>
        </div>

        <div className="home-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="home-feature-card">
              <span className={`home-feature-dot ${f.live ? 'home-feature-dot-live' : ''}`} />
              <div>
                <h3 className="home-feature-title">{f.title}</h3>
                <p className="home-feature-desc">{f.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <span className="site-credit" aria-hidden="true">
        Z1roNNN
      </span>
    </div>
  )
}
