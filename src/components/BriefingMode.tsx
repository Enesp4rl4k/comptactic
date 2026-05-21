import { useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import TacticalBoard from './TacticalBoard'

// Fullscreen, read-only playback of the slides for a tactic briefing.
export default function BriefingMode({ onClose }: { onClose: () => void }) {
  const slides = useBoardStore((s) => s.slides)
  const activeSlideId = useBoardStore((s) => s.activeSlideId)
  const setActiveSlide = useBoardStore((s) => s.setActiveSlide)
  const nextSlide = useBoardStore((s) => s.nextSlide)
  const prevSlide = useBoardStore((s) => s.prevSlide)

  const [playing, setPlaying] = useState(false)
  const [seconds, setSeconds] = useState(5)
  const originalRef = useRef(activeSlideId)

  const idx = slides.findIndex((s) => s.id === activeSlideId)
  const active = slides[idx]

  // restore the slide that was open before briefing started
  useEffect(() => {
    const original = originalRef.current
    return () => setActiveSlide(original)
  }, [setActiveSlide])

  // autoplay loop
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const st = useBoardStore.getState()
      const i = st.slides.findIndex((s) => s.id === st.activeSlideId)
      if (i >= st.slides.length - 1) st.setActiveSlide(st.slides[0].id)
      else st.setActiveSlide(st.slides[i + 1].id)
    }, seconds * 1000)
    return () => clearInterval(id)
  }, [playing, seconds])

  // keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') nextSlide()
      else if (e.key === 'ArrowLeft') prevSlide()
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, nextSlide, prevSlide])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 h-12 bg-panel border-b border-edge shrink-0">
        <span className="font-display font-semibold tracking-wide text-accent">
          Comp<span className="text-white">Tactic</span> · Briefing
        </span>
        <span className="text-sm text-gray-300 truncate">
          {idx + 1}. {active?.name}
        </span>
        <span className="text-xs text-gray-500">
          {idx + 1} / {slides.length}
        </span>
        <button onClick={onClose} className="ml-auto btn" title="Close (Esc)">
          ✕ Exit
        </button>
      </div>

      {/* board */}
      <div className="flex-1 min-h-0 relative">
        <TacticalBoard readOnly />
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-3 px-4 h-14 bg-panel border-t border-edge shrink-0">
        <button onClick={prevSlide} disabled={idx <= 0} className="btn disabled:opacity-30" title="Previous (←)">
          ◀
        </button>
        <button onClick={() => setPlaying((p) => !p)} className="btn btn-primary w-24" title="Play/Pause (Space)">
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button onClick={nextSlide} disabled={idx >= slides.length - 1} className="btn disabled:opacity-30" title="Next (→)">
          ▶
        </button>

        <div className="mx-2 h-6 w-px bg-edge" />

        <label className="flex items-center gap-2 text-xs text-gray-400">
          Auto
          <input
            type="range"
            min={2}
            max={15}
            step={1}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-28 accent-neutral-400"
          />
          <span className="tabular-nums w-8 text-gray-300">{seconds}s</span>
        </label>

        {/* slide dots */}
        <div className="flex gap-1.5 ml-3">
          {slides.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSlide(s.id)}
              title={s.name}
              className={`h-2.5 w-2.5 rounded-full ${s.id === activeSlideId ? 'bg-white' : 'bg-edge hover:bg-gray-500'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
