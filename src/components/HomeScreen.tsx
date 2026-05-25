import { useEffect, useState } from 'react'
import { parseRoomInput } from '../lib/roomEntry'
import { formatRecentRoomWhen, loadRecentRooms, removeRecentRoom, type RecentRoom } from '../lib/recentRooms'
import { useAuth } from '../lib/useAuth'
import ThemeMenu from './ThemeMenu'

interface Props {
  onOpenRoom: () => void
  onJoinRoom: (roomId: string, viewOnly: boolean) => void
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

const BG_SLIDES = [
  { src: asset('home/joinsquad-1-wetlands.jpg'), className: 'home-bg-slide--1' },
  { src: asset('home/joinsquad-2-heli.jpg'), className: 'home-bg-slide--2' },
  { src: asset('home/joinsquad-3-tank.jpg'), className: 'home-bg-slide--3' },
  { src: asset('home/joinsquad-4-car.jpg'), className: 'home-bg-slide--4' },
  { src: asset('home/joinsquad-5-art.jpg'), className: 'home-bg-slide--5' },
  { src: asset('home/joinsquad-6-strip.jpg'), className: 'home-bg-slide--6' },
] as const

const NOTES = ['Live map sync', 'Line-up & vehicles', 'Host sets edit access']

export default function HomeScreen({ onOpenRoom, onJoinRoom }: Props) {
  const { user } = useAuth()
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentRoom[]>(() => loadRecentRooms(user?.id))

  useEffect(() => {
    setRecent(loadRecentRooms(user?.id))
  }, [user?.id])

  const onJoin = () => {
    const parsed = parseRoomInput(joinInput)
    if (!parsed) {
      setJoinError('Enter a room code or paste an invite link')
      return
    }
    setJoinError(null)
    onJoinRoom(parsed.room, parsed.viewOnly)
  }

  const joinRecent = (r: RecentRoom) => {
    setJoinError(null)
    onJoinRoom(r.id, !!r.viewOnly)
  }

  const dismissRecent = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation()
    removeRecentRoom(roomId, user?.id)
    setRecent(loadRecentRooms(user?.id))
  }

  return (
    <div className="home-screen">
      <div className="home-bg" aria-hidden="true">
        <div className="home-bg-slides">
          {BG_SLIDES.map((slide) => (
            <img
              key={slide.src}
              src={slide.src}
              alt=""
              className={`home-bg-slide ${slide.className}`}
              decoding="async"
              fetchPriority={slide.className === 'home-bg-slide--1' ? 'high' : 'low'}
            />
          ))}
        </div>
        <div className="home-bg-scrim" />
        <div className="home-bg-vignette" />
      </div>

      <div className="home-theme-menu">
        <ThemeMenu align="right" />
      </div>

      <main className="home-main">
        <header className="home-brand">
          <p className="home-eyebrow">
            <span className="home-eyebrow-mark" aria-hidden="true" />
            <span className="home-eyebrow-muted">Squad</span>
            <span className="home-eyebrow-sep">·</span>
            <span className="home-eyebrow-red">Tactics</span>
          </p>
          <h1 className="home-logo">
            <span className="home-logo-comp">Comp</span>
            <span className="home-logo-accent">Tactic</span>
          </h1>
          <p className="home-kicker">Plan maps, line-ups, and briefings in one room</p>
        </header>

        <section className="home-primary">
          <div className="home-primary-copy">
            <h2 className="home-primary-title">New room</h2>
            <p className="home-primary-desc">You host — invite others when ready.</p>
          </div>
          <button type="button" className="home-primary-btn" onClick={onOpenRoom}>
            Open tactic room
          </button>
        </section>

        {recent.length > 0 && (
          <section className="home-recent" aria-label="Recent rooms">
            <div className="home-recent-head">
              <h2 className="home-recent-title">Recent rooms</h2>
              <span className="home-recent-meta">{user ? 'Your account' : 'This device'}</span>
            </div>
            <ul className="home-recent-list">
              {recent.map((r) => (
                <li key={r.id}>
                  <button type="button" className="home-recent-item" onClick={() => joinRecent(r)}>
                    <span className="home-recent-code">{r.id}</span>
                    <span className="home-recent-detail">
                      {r.label && <span className="home-recent-label">{r.label}</span>}
                      <span className="home-recent-when">
                        {r.host && <span className="home-recent-badge">Host</span>}
                        {r.viewOnly && <span className="home-recent-badge home-recent-badge--view">View</span>}
                        <span>{formatRecentRoomWhen(r.at)}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="home-recent-remove"
                    onClick={(e) => dismissRecent(e, r.id)}
                    aria-label={`Remove ${r.id} from recent`}
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="home-divider">
          <span>or join</span>
        </div>

        <section className="home-join">
          <label htmlFor="join-room" className="home-join-label">
            Room code or invite link
          </label>
          <input
            id="join-room"
            type="text"
            value={joinInput}
            onChange={(e) => {
              setJoinInput(e.target.value)
              if (joinError) setJoinError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && onJoin()}
            placeholder="xK9mP2aQ or https://…?room=…"
            className="input home-join-input home-join-input-full"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="home-join-hint">
            Room code: host chooses viewer or editor in Members. View-only only if you paste a view invite link.
          </p>
          <button type="button" className="home-join-submit" onClick={onJoin}>
            Join room
          </button>
          {joinError && (
            <p className="home-join-error" role="alert">
              {joinError}
            </p>
          )}
        </section>

        <ul className="home-notes">
          {NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </main>

      <p className="home-attribution" aria-hidden="true">
        Background: Squad · joinsquad.com
      </p>
    </div>
  )
}
