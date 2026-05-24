import { useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from './ui/Icons'
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

        <NavBtn title="Previous slide" onClick={prevSlide} disabled={idx <= 0}>
          <IconChevronLeft size={14} />
        </NavBtn>

        {!readOnly && (
          <NavBtn
            title="Delete slide"
            onClick={() => {
              if (slides.length > 1 && confirm('Delete this slide?')) removeSlide(activeSlideId)
            }}
            disabled={slides.length <= 1}
          >
            <IconTrash size={14} />
          </NavBtn>
        )}

        {readOnly ? (
          <span className="h-8 min-w-[3rem] px-3 grid place-items-center rounded-lg bg-panel2 border border-edge text-sm text-zinc-200">
            {active?.name}
          </span>
        ) : (
          <input
            value={active?.name ?? ''}
            onChange={(e) => renameSlide(activeSlideId, e.target.value)}
            placeholder="Slide name…"
            className="input h-8 w-40 !py-1 text-sm"
            title="Rename this slide"
          />
        )}

        {!readOnly && (
          <NavBtn title="Add slide" onClick={addSlide} accent>
            <IconPlus size={14} />
          </NavBtn>
        )}

        <NavBtn title="Next slide" onClick={nextSlide} disabled={idx >= slides.length - 1}>
          <IconChevronRight size={14} />
        </NavBtn>

        <span className="text-[11px] text-zinc-500 mx-1 tabular-nums">
          {idx + 1}/{slides.length}
        </span>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            title="Slide briefing notes"
            className={`h-8 px-2.5 rounded-lg border text-xs shrink-0 cursor-pointer transition-colors ${
              notesOpen || active?.notes
                ? 'bg-highlight/15 border-highlight/50 text-highlight'
                : 'bg-panel2 border-edge text-zinc-500 hover:text-zinc-200'
            }`}
          >
            Notes
          </button>
        )}

        <div className="flex gap-1 overflow-x-auto ml-1 min-w-0 flex-1 pb-0.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSlide(s.id)}
              title={s.notes ? `${s.name}\n${s.notes}` : s.name}
              className={`slide-pill max-w-[10rem] truncate font-medium ${
                s.id === activeSlideId ? 'slide-pill-active' : 'slide-pill-idle'
              } ${s.notes ? 'ring-1 ring-amber-500/35' : ''}`}
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
  children,
  title,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-8 w-8 grid place-items-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        accent
          ? 'bg-highlight/20 border-highlight/50 text-zinc-100 hover:bg-highlight/30'
          : 'bg-panel2 border-edge text-zinc-400 hover:bg-edge hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  )
}
