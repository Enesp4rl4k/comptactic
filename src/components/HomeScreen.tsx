import { useState } from 'react'
import { parseRoomInput } from '../lib/roomEntry'
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
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)

  const onJoin = () => {
    const parsed = parseRoomInput(joinInput)
    if (!parsed) {
      setJoinError('Enter a room code or paste an invite link')
      return
    }
    setJoinError(null)
    // view=1 only from host’s view-only invite link — plain room code uses host policy
    onJoinRoom(parsed.room, parsed.viewOnly)
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
