import { useEffect, useRef } from 'react'
import { useBoardStore } from '../store/useBoardStore'
import TacticalBoard from './TacticalBoard'
import type { RosterSquad, Team } from '../types'

const TEAM_LABEL: Record<Team, string> = {
  blufor: 'BLUFOR',
  opfor: 'OPFOR',
  neutral: 'Neutral',
}

const TEAM_ACCENT: Record<Team, string> = {
  blufor: 'text-blue-400',
  opfor: 'text-red-400',
  neutral: 'text-amber-400',
}

// Fullscreen briefing: manual slide navigation + per-squad notes panel.
export default function BriefingMode({ onClose, canEdit = false }: { onClose: () => void; canEdit?: boolean }) {
  const slides = useBoardStore((s) => s.slides)
  const activeSlideId = useBoardStore((s) => s.activeSlideId)
  const setActiveSlide = useBoardStore((s) => s.setActiveSlide)
  const nextSlide = useBoardStore((s) => s.nextSlide)
  const prevSlide = useBoardStore((s) => s.prevSlide)

  const originalRef = useRef(activeSlideId)

  const idx = slides.findIndex((s) => s.id === activeSlideId)
  const active = slides[idx]

  useEffect(() => {
    const original = originalRef.current
    return () => setActiveSlide(original)
  }, [setActiveSlide])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') nextSlide()
      else if (e.key === 'ArrowLeft') prevSlide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, nextSlide, prevSlide])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 h-12 bg-panel border-b border-edge shrink-0">
        <span className="font-display font-semibold tracking-wide text-accent shrink-0">
          Comp<span className="text-white">Tactic</span> · Briefing
        </span>
        <span className="text-sm text-gray-300 truncate min-w-0">
          {idx + 1}. {active?.name}
        </span>
        <span className="text-xs text-gray-500 tabular-nums shrink-0">
          {idx + 1} / {slides.length}
        </span>
        <button type="button" onClick={onClose} className="ml-auto btn shrink-0" title="Close (Esc)">
          ✕ Exit
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-h-0 min-w-0 relative">
          <TacticalBoard readOnly />
        </div>
        <BriefingNotesPanel canEdit={canEdit} />
      </div>

      <div className="flex items-center justify-center gap-3 px-4 h-14 bg-panel border-t border-edge shrink-0">
        <button
          type="button"
          onClick={prevSlide}
          disabled={idx <= 0}
          className="btn disabled:opacity-30"
          title="Previous (←)"
        >
          ◀ Prev
        </button>
        <button
          type="button"
          onClick={nextSlide}
          disabled={idx >= slides.length - 1}
          className="btn disabled:opacity-30"
          title="Next (→)"
        >
          Next ▶
        </button>

        <div className="flex gap-1.5 ml-2 overflow-x-auto max-w-[50vw]">
          {slides.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSlide(s.id)}
              title={s.name}
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.id === activeSlideId ? 'bg-white' : 'bg-edge hover:bg-gray-500'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BriefingNotesPanel({ canEdit }: { canEdit: boolean }) {
  const squads = useBoardStore((s) => s.squads)
  const updateSquad = useBoardStore((s) => s.updateSquad)

  const groups: { team: Team; list: RosterSquad[] }[] = (
    [
      { team: 'blufor' as const, list: squads.filter((s) => s.team === 'blufor') },
      { team: 'opfor' as const, list: squads.filter((s) => s.team === 'opfor') },
      { team: 'neutral' as const, list: squads.filter((s) => s.team === 'neutral') },
    ] as const
  ).filter((g) => g.list.length > 0)

  return (
    <aside className="briefing-notes-panel shrink-0 lg:w-[22rem] xl:w-96 border-t lg:border-t-0 lg:border-l border-edge bg-panel/98 flex flex-col max-h-[40vh] lg:max-h-none">
      <div className="px-4 py-3 border-b border-edge shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Squad briefing notes</h2>
        <p className="text-[11px] text-zinc-600 mt-0.5">
          {canEdit ? 'Write orders for each squad before the briefing.' : 'Read-only — host can edit notes.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {squads.length === 0 && (
          <p className="text-xs text-zinc-600 px-1 py-4 text-center">
            No squads yet. Add squads in Line-up, then return here to write briefing notes.
          </p>
        )}
        {groups.map(({ team, list }) => (
          <section key={team}>
            <h3 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${TEAM_ACCENT[team]}`}>
              {TEAM_LABEL[team]}
            </h3>
            <div className="space-y-2">
              {list.map((sq) => (
                <SquadNoteCard
                  key={sq.id}
                  squad={sq}
                  canEdit={canEdit}
                  onChange={(note) => updateSquad(sq.id, { briefingNote: note })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}

function SquadNoteCard({
  squad,
  canEdit,
  onChange,
}: {
  squad: RosterSquad
  canEdit: boolean
  onChange: (note: string) => void
}) {
  const hasNote = Boolean(squad.briefingNote?.trim())

  return (
    <div
      className="rounded-lg border border-edge bg-panel2/80 overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: squad.color }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-edge/50">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: squad.color }} />
        <span className="text-sm font-medium text-zinc-100 truncate flex-1">{squad.name || 'Squad'}</span>
        {hasNote && !canEdit && (
          <span className="text-[9px] uppercase tracking-wide text-amber-500/80 font-semibold">Note</span>
        )}
      </div>
      {canEdit ? (
        <textarea
          value={squad.briefingNote ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Objectives, routes, timings…"
          rows={3}
          className="w-full bg-transparent px-2.5 py-2 text-sm text-zinc-200 outline-none resize-y min-w-0 min-h-[4.5rem] placeholder:text-zinc-600"
        />
      ) : (
        <div className="px-2.5 py-2 text-sm text-zinc-300 whitespace-pre-wrap min-h-[2.5rem]">
          {hasNote ? squad.briefingNote : <span className="text-zinc-600 italic">No notes</span>}
        </div>
      )}
    </div>
  )
}

