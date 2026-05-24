// Keyboard & mouse shortcut reference. Opened with "?" or the header button.
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Board',
    items: [
      ['Left click', 'Draw / place / select'],
      ['Right click + drag', 'Pan the map'],
      ['Mouse wheel', 'Zoom to cursor'],
      ['Shift + click', 'Add to selection'],
      ['Arrow keys', 'Nudge selection (Shift = 10×)'],
      ['Delete / Backspace', 'Delete selected'],
      ['Esc', 'Cancel / deselect / Select tool'],
    ],
  },
  {
    title: 'Edit',
    items: [
      ['Ctrl/⌘ + Z', 'Undo'],
      ['Ctrl/⌘ + Shift + Z / Ctrl + Y', 'Redo'],
      ['Ctrl/⌘ + C', 'Copy selection'],
      ['Ctrl/⌘ + V', 'Paste (or paste an image as background)'],
      ['Ctrl/⌘ + D', 'Duplicate selection'],
    ],
  },
  {
    title: 'Tools (press the key)',
    items: [
      ['V', 'Select / Move'],
      ['A · L · P', 'Arrow · Line · Freehand'],
      ['R · C · Z', 'Rectangle · Circle · Zone'],
      ['T · M · O · G', 'Text · Measure · Range · Ping'],
    ],
  },
  {
    title: 'Tips',
    items: [
      ['Shift + Arrow/Line', 'Constrain to 45° angles'],
      ['Pen', 'Start near a previous stroke end to continue it'],
      ['Zone', 'Click corners, double-click / Enter to close'],
      ['Hover FOB', 'Show 150 m / 300 m radius rings'],
      ['Briefing → ← / →', 'Change slides manually (squad notes in side panel)'],
    ],
  },
]

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[620px] max-w-[94vw] max-h-[86vh] bg-panel border border-edge rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <h2 className="font-display font-semibold tracking-wide">Keyboard &amp; mouse shortcuts</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white text-xl leading-none cursor-pointer">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid sm:grid-cols-2 gap-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] font-semibold tracking-wide text-gray-400 mb-2">{g.title.toUpperCase()}</div>
              <div className="space-y-1.5">
                {g.items.map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2 text-sm">
                    <kbd className="shrink-0 rounded bg-panel2 border border-edge px-1.5 py-0.5 text-[11px] text-gray-200">{k}</kbd>
                    <span className="text-gray-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
