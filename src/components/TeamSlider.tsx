import type { Team } from '../types'

const TEAMS: { id: Team; label: string; short: string; color: string }[] = [
  { id: 'blufor', label: 'BLUFOR', short: 'Blu', color: '#3b82f6' },
  { id: 'opfor', label: 'OPFOR', short: 'Opf', color: '#ef4444' },
  { id: 'neutral', label: 'Neutral', short: 'Neu', color: '#eab308' },
]

export default function TeamSlider({ team, onChange }: { team: Team; onChange: (team: Team) => void }) {
  const index = Math.max(0, TEAMS.findIndex((t) => t.id === team))
  const active = TEAMS[index] ?? TEAMS[0]

  return (
    <div className="team-slider" title="Slide to change drawing team">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Team</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: active.color }}>
          {active.label}
        </span>
      </div>

      <div className="relative h-9 rounded-lg border border-edge bg-panel2 p-0.5 select-none">
        <span
          className="absolute top-0.5 bottom-0.5 w-[calc(33.333%-2px)] rounded-md transition-[transform,background-color] duration-200 ease-out shadow-sm"
          style={{
            transform: `translateX(calc(${index * 100}% + ${index * 2}px))`,
            backgroundColor: active.color,
          }}
          aria-hidden
        />
        <div className="relative z-10 grid grid-cols-3 h-full">
          {TEAMS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer rounded-md ${
                i === index ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={t.label}
            >
              {t.short}
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={2}
        step={1}
        value={index}
        onChange={(e) => onChange(TEAMS[Number(e.target.value)]!.id)}
        className="team-range mt-1.5 w-full"
        style={{ ['--team-thumb' as string]: active.color }}
        aria-label="Team: BLUFOR, OPFOR, or Neutral"
        aria-valuetext={active.label}
      />
    </div>
  )
}
