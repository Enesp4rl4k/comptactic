import { useState } from 'react'
import { parseRoomInput } from '../lib/roomEntry'
import ThemeMenu from './ThemeMenu'

interface Props {
  onOpenRoom: () => void
  onJoinRoom: (roomId: string) => void
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
    const room = parseRoomInput(joinInput)
    if (!room) {
      setJoinError('Paste a share link or room code')
      return
    }
    setJoinError(null)
    onJoinRoom(room)
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
            Invite link or room code
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
              placeholder="https://… or abc123"
              className="input home-join-input"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="btn home-join-btn" onClick={onJoin}>
              Join
            </button>
          </div>
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
      <span className="site-credit" aria-hidden="true">
        Z1roNNN
      </span>
    </div>
  )
}
