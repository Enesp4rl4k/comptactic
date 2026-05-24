import { useEffect, useRef } from 'react'
import { startCollab, type CollabBoardPayload } from '../lib/collab'
import { boardSyncFingerprint, isStructuralBoardChange, rosterSyncFingerprint } from '../lib/collabPayload'
import { useBoardStore } from '../store/useBoardStore'

const BOARD_DEBOUNCE_IDLE_MS = 120
const BOARD_DEBOUNCE_DRAW_MS = 320
const ROSTER_DEBOUNCE_MS = 280
const FULL_SYNC_INTERVAL_MS = 12_000

/** Adaptive realtime sync: light board patches, roster merge, flush on edit end. */
export function useCollabSync(roomId: string, viewOnly: boolean) {
  const handleRef = useRef<ReturnType<typeof startCollab> | null>(null)
  const lastBoardFp = useRef('')
  const lastRosterFp = useRef('')
  const lastFullBoard = useRef<CollabBoardPayload | null>(null)
  const boardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rosterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fullSyncTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const applyingRemote = useRef(false)

  useEffect(() => {
    if (!roomId) return
    const handle = startCollab(
      roomId,
      (board) => {
        applyingRemote.current = true
        useBoardStore.getState().applyRemoteBoard(board)
        applyingRemote.current = false
      },
      (roster) => {
        applyingRemote.current = true
        useBoardStore.getState().applyRemoteRoster(roster)
        applyingRemote.current = false
      },
      () => useBoardStore.getState().toBoardPayload('full'),
      () => useBoardStore.getState().toRosterPayload(),
    )
    handleRef.current = handle

    fullSyncTimer.current = setInterval(() => {
      if (viewOnly) return
      const board = useBoardStore.getState().toBoardPayload('full')
      handle.broadcastBoard(board, { urgent: true })
      lastBoardFp.current = boardSyncFingerprint(board)
      lastFullBoard.current = board
    }, FULL_SYNC_INTERVAL_MS)

    const flushBoard = (urgent = false) => {
      if (viewOnly || !handleRef.current) return
      const state = useBoardStore.getState()
      const structural = isStructuralBoardChange(lastFullBoard.current, state.toBoardPayload('full'))
      const mode = structural ? 'full' : 'light'
      const board = state.toBoardPayload(mode)
      const fp = boardSyncFingerprint(board)
      if (fp === lastBoardFp.current) return
      lastBoardFp.current = fp
      if (mode === 'full') lastFullBoard.current = board
      handleRef.current.broadcastBoard(board, { urgent })
    }

    const flushRoster = (urgent = false) => {
      if (viewOnly || !handleRef.current) return
      const roster = useBoardStore.getState().toRosterPayload()
      const fp = rosterSyncFingerprint(roster)
      if (fp === lastRosterFp.current) return
      lastRosterFp.current = fp
      handleRef.current.broadcastRoster(roster, { urgent })
    }

    const scheduleBoard = () => {
      clearTimeout(boardTimer.current)
      const lock = useBoardStore.getState().editingLock
      const ms = lock === 'board' ? BOARD_DEBOUNCE_DRAW_MS : BOARD_DEBOUNCE_IDLE_MS
      boardTimer.current = setTimeout(() => flushBoard(false), ms)
    }

    const scheduleRoster = () => {
      clearTimeout(rosterTimer.current)
      rosterTimer.current = setTimeout(() => flushRoster(false), ROSTER_DEBOUNCE_MS)
    }

    const unsub = viewOnly
      ? () => {}
      : useBoardStore.subscribe((state, prev) => {
          if (applyingRemote.current) return

          const boardChanged =
            state.mapId !== prev.mapId ||
            state.layerId !== prev.layerId ||
            state.customImage !== prev.customImage ||
            state.customImageName !== prev.customImageName ||
            state.customMapMeta !== prev.customMapMeta ||
            state.slides !== prev.slides ||
            state.activeSlideId !== prev.activeSlideId ||
            state.boards !== prev.boards ||
            state.activeKey !== prev.activeKey ||
            state.elements !== prev.elements ||
            state.elementTombstones !== prev.elementTombstones

          const rosterChanged =
            state.squads !== prev.squads ||
            state.vehicles !== prev.vehicles ||
            state.playerPool !== prev.playerPool

          if (boardChanged) scheduleBoard()

          if (rosterChanged) scheduleRoster()

          if (prev.editingLock && !state.editingLock) {
            clearTimeout(boardTimer.current)
            clearTimeout(rosterTimer.current)
            flushBoard(true)
            flushRoster(true)
          }
        })

    return () => {
      clearTimeout(boardTimer.current)
      clearTimeout(rosterTimer.current)
      clearInterval(fullSyncTimer.current)
      unsub()
      handle.stop()
      handleRef.current = null
    }
  }, [roomId, viewOnly])
}
