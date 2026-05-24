import { useBoardStore } from '../store/useBoardStore'

/** Shown when a collaborator's edits were held while you drag or draw. */
export default function CollabBanner() {
  const pendingBoard = useBoardStore((s) => s.pendingRemoteBoard)
  const pendingRoster = useBoardStore((s) => s.pendingRemoteRoster)
  const editingLock = useBoardStore((s) => s.editingLock)
  const applyPendingCollab = useBoardStore((s) => s.applyPendingCollab)

  if (!pendingBoard && !pendingRoster) return null

  const parts: string[] = []
  if (pendingBoard) parts.push('board')
  if (pendingRoster) parts.push('line-up')

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-950/90 text-amber-100 text-sm shadow-panel backdrop-blur-md max-w-[min(92vw,28rem)] animate-banner-in">
      <span className="truncate">
        Collaborator updated {parts.join(' & ')}
        {editingLock ? ' — finish your edit to auto-merge, or apply now' : ''}
      </span>
      <button type="button" className="btn btn-primary h-7 px-2.5 text-xs shrink-0" onClick={() => applyPendingCollab()}>
        Apply
      </button>
    </div>
  )
}
