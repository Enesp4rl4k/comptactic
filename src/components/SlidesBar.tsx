import { useState } from 'react'
import { useBoardStore } from '../store/useBoardStore'

// Slide switcher: multiple tactic boards on the same map/layer.
export default function SlidesBar({ readOnly = false }: { readOnly?: boolean }) {
  const slides = useBoardStore((s) => s.slides)
  const activeSlideId = useBoardStore((s) => s.activeSlideId)
  const setActiveSlide = useBoardStore((s) => s.setActiveSlide)
  const addSlide = useBoardStore((s) => s.addSlide)
  const removeSlide = useBoardStore((s) => s.removeSlide)
  const renameSlide = useBoardStore((s) => s.renameSlide)
  const setSlideNotes = useBoardStore((s) => s.setSlideNotes)
  const nextSlide = useBoardStore((s) => s.nextSlide)
  const prevSlide = useBoardStore((s) => s.prevSlide)
  const [notesOpen, setNotesOpen] = useState(false)

  const idx = slides.findIndex((s) => s.id === activeSlideId)
  const active = slides[idx]

  return (
    <div className="flex flex-col border-t border-edge bg-panel">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <span className="text-xs uppercase tracking-wide text-gray-500 mr-1">Slides</span>

        <NavBtn label="◀" title="Previous slide" onClick={prevSlide} disabled={idx <= 0} />

        {!readOnly && (
          <NavBtn
            label="🗑"
            title="Delete slide"
            onClick={() => {
              if (slides.length > 1 && confirm('Delete this slide?')) removeSlide(activeSlideId)
            }}
            disabled={slides.length <= 1}
          />
        )}

        {readOnly ? (
          <span className="h-7 min-w-[3rem] px-3 grid place-items-center rounded bg-panel2 border border-edge text-sm">
            {active?.name}
          </span>
        ) : (
          <input
            value={active?.name ?? ''}
            onChange={(e) => renameSlide(activeSlideId, e.target.value)}
            placeholder="Slide name…"
            className="h-7 w-40 rounded bg-panel2 border border-edge px-2 text-sm outline-none focus:border-accent placeholder:text-gray-600"
            title="Rename this slide"
          />
        )}

        {!readOnly && <NavBtn label="+" title="Add slide" onClick={addSlide} accent />}

        <NavBtn label="▶" title="Next slide" onClick={nextSlide} disabled={idx >= slides.length - 1} />

        <span className="text-[11px] text-gray-500 mx-1">
          {idx + 1}/{slides.length}
        </span>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            title="Slide briefing notes"
            className={`h-7 px-2 rounded border text-xs shrink-0 cursor-pointer ${
              notesOpen || active?.notes
                ? 'bg-accent/20 border-accent text-accent'
                : 'bg-panel2 border-edge text-gray-400 hover:text-white'
            }`}
          >
            Notes
          </button>
        )}

        <div className="flex gap-1 overflow-x-auto ml-1 min-w-0 flex-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveSlide(s.id)}
              title={s.notes ? `${s.name}\n${s.notes}` : s.name}
              className={`h-7 max-w-[10rem] truncate px-2 rounded text-xs font-medium border shrink-0 cursor-pointer ${
                s.id === activeSlideId
                  ? 'bg-accent border-accent text-white'
                  : 'bg-panel2 border-edge text-gray-300 hover:bg-edge'
              } ${s.notes ? 'ring-1 ring-amber-500/40' : ''}`}
            >
              {s.name || i + 1}
            </button>
          ))}
        </div>
      </div>

      {notesOpen && !readOnly && (
        <div className="px-3 pb-2">
          <textarea
            value={active?.notes ?? ''}
            onChange={(e) => setSlideNotes(activeSlideId, e.target.value)}
            placeholder="Briefing notes for this slide…"
            rows={2}
            className="w-full rounded bg-panel2 border border-edge px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-accent resize-y min-h-[3rem] placeholder:text-gray-600"
          />
        </div>
      )}

      {readOnly && active?.notes && (
        <div className="px-3 pb-2 text-sm text-gray-300 border-t border-edge/50 pt-2">{active.notes}</div>
      )}
    </div>
  )
}

function NavBtn({
  label,
  title,
  onClick,
  disabled,
  accent,
}: {
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-7 w-7 grid place-items-center rounded border text-sm disabled:opacity-30 disabled:cursor-not-allowed ${
        accent
          ? 'bg-accent border-accent text-white hover:brightness-125'
          : 'bg-panel2 border-edge text-gray-300 hover:bg-edge'
      }`}
    >
      {label}
    </button>
  )
}
