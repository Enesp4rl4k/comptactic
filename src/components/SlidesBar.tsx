import { useBoardStore } from '../store/useBoardStore'

// Slide switcher: multiple tactic boards on the same map/layer.
export default function SlidesBar({ readOnly = false }: { readOnly?: boolean }) {
  const slides = useBoardStore((s) => s.slides)
  const activeSlideId = useBoardStore((s) => s.activeSlideId)
  const setActiveSlide = useBoardStore((s) => s.setActiveSlide)
  const addSlide = useBoardStore((s) => s.addSlide)
  const removeSlide = useBoardStore((s) => s.removeSlide)
  const renameSlide = useBoardStore((s) => s.renameSlide)
  const nextSlide = useBoardStore((s) => s.nextSlide)
  const prevSlide = useBoardStore((s) => s.prevSlide)

  const idx = slides.findIndex((s) => s.id === activeSlideId)
  const active = slides[idx]

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-panel border-t border-edge">
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
          className="h-7 w-20 text-center rounded bg-panel2 border border-edge text-sm outline-none focus:border-blue-500"
          title="Slide name"
        />
      )}

      {!readOnly && <NavBtn label="+" title="Add slide" onClick={addSlide} accent />}

      <NavBtn label="▶" title="Next slide" onClick={nextSlide} disabled={idx >= slides.length - 1} />

      <span className="text-[11px] text-gray-500 mx-1">{idx + 1}/{slides.length}</span>

      {/* quick-jump chips */}
      <div className="flex gap-1 overflow-x-auto ml-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveSlide(s.id)}
            title={s.name}
            className={`h-7 min-w-[1.75rem] px-2 rounded text-xs font-medium border shrink-0 ${
              s.id === activeSlideId
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-panel2 border-edge text-gray-300 hover:bg-edge'
            }`}
          >
            {s.name || i + 1}
          </button>
        ))}
      </div>
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
          ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500'
          : 'bg-panel2 border-edge text-gray-300 hover:bg-edge'
      }`}
    >
      {label}
    </button>
  )
}
