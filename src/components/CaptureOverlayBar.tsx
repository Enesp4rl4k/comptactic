import { useState } from 'react'
import { filterCapturePoints, loadCpOverlayPrefs, saveCpOverlayPrefs, type CpOverlayPrefs } from '../lib/cpOverlay'
import { getCapturePointsSync } from '../lib/capturePoints'

interface Props {
  layerId: string | null
  prefs: CpOverlayPrefs
  onChange: (p: CpOverlayPrefs) => void
}

export function useCpOverlayPrefs() {
  return useState<CpOverlayPrefs>(() => loadCpOverlayPrefs())
}

export function countVisibleCaps(layerId: string | null, prefs: CpOverlayPrefs): number {
  if (!layerId) return 0
  const raw = getCapturePointsSync(layerId) ?? []
  return filterCapturePoints(raw, prefs).length
}

export default function CaptureOverlayBar({ layerId, prefs, onChange }: Props) {
  if (!layerId) return null
  const raw = getCapturePointsSync(layerId)
  if (!raw?.length) return null

  const visible = filterCapturePoints(raw, prefs)
  const set = (patch: Partial<CpOverlayPrefs>) => {
    const next = { ...prefs, ...patch }
    saveCpOverlayPrefs(next)
    onChange(next)
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-edge bg-panel2/95 px-2 py-1.5 text-xs shadow-lg backdrop-blur max-w-[min(100%,20rem)]">
      <span className="text-gray-400 font-medium">CP</span>
      <Toggle on={prefs.show} onClick={() => set({ show: !prefs.show })} label={prefs.show ? 'On' : 'Off'} />
      {prefs.show && (
        <>
          <Toggle on={prefs.hideMains} onClick={() => set({ hideMains: !prefs.hideMains })} label="Hide mains" />
          <span className="text-gray-500 tabular-nums">
            {visible.length}/{raw.length}
          </span>
        </>
      )}
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-2 rounded border cursor-pointer transition-colors ${
        on ? 'bg-accent/20 border-accent text-amber-100' : 'bg-panel border-edge text-gray-500'
      }`}
    >
      {label}
    </button>
  )
}
