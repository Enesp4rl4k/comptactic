import { useEffect, useState } from 'react'
import type { BoardSnapshot } from '../types'
import { useAuth } from '../lib/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { listPlans, getPlan, createPlan, updatePlan, deletePlan, duplicatePlan, type PlanRow } from '../lib/plans'

interface Props {
  onClose: () => void
  getSnapshot: () => BoardSnapshot
  onOpenPlan: (id: string, title: string, data: BoardSnapshot) => void
  onSaved: (id: string, title: string) => void
  currentPlanId: string | null
  currentTitle: string
  onRequireSignIn: () => void
}

export default function PlansModal({
  onClose,
  getSnapshot,
  onOpenPlan,
  onSaved,
  currentPlanId,
  currentTitle,
  onRequireSignIn,
}: Props) {
  const { user } = useAuth()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canUse = isSupabaseConfigured && !!user

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setPlans(await listPlans())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canUse) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const saveNew = () =>
    run(async () => {
      const title = window.prompt('Plan name:', currentTitle || 'Untitled plan')
      if (!title) return
      const id = await createPlan(title, getSnapshot())
      onSaved(id, title)
      await refresh()
    })

  const saveCurrent = () =>
    run(async () => {
      if (!currentPlanId) return saveNew()
      await updatePlan(currentPlanId, { data: getSnapshot() })
      await refresh()
    })

  const open = (p: PlanRow) =>
    run(async () => {
      const { title, data } = await getPlan(p.id)
      onOpenPlan(p.id, title, data)
      onClose()
    })

  const rename = (p: PlanRow) =>
    run(async () => {
      const title = window.prompt('Rename plan:', p.title)
      if (!title || title === p.title) return
      await updatePlan(p.id, { title })
      await refresh()
    })

  const dup = (p: PlanRow) => run(async () => { await duplicatePlan(p.id); await refresh() })
  const del = (p: PlanRow) =>
    run(async () => {
      if (!confirm(`Delete “${p.title}”?`)) return
      await deletePlan(p.id)
      await refresh()
    })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div
        className="w-[520px] max-w-[94vw] max-h-[86vh] bg-panel border border-edge rounded-lg overflow-hidden flex flex-col shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <h2 className="font-display font-semibold tracking-wide">My Plans</h2>
          {canUse && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={saveCurrent} disabled={busy} className="btn btn-primary h-7 px-2.5 text-xs">
                {currentPlanId ? 'Update current' : 'Save plan'}
              </button>
              {currentPlanId && (
                <button onClick={saveNew} disabled={busy} className="btn h-7 px-2.5 text-xs">
                  Save as new
                </button>
              )}
            </div>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none cursor-pointer">
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {!isSupabaseConfigured ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
              Supabase is not configured. Add your project URL and anon key to <code>.env.local</code> and run the SQL in
              <code className="mx-1">supabase/schema.sql</code>.
            </div>
          ) : !user ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-gray-400">Sign in to save and load plans in the cloud.</p>
              <button onClick={() => { onClose(); onRequireSignIn() }} className="btn btn-primary">Sign in</button>
            </div>
          ) : (
            <>
              {error && <div className="mb-2 text-[12px] text-red-400">{error}</div>}
              {loading ? (
                <div className="text-sm text-gray-500 py-6 text-center">Loading…</div>
              ) : plans.length === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">
                  No saved plans yet. Use “Save plan” to store the current board.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {plans.map((p) => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                        p.id === currentPlanId ? 'border-accent bg-blue-500/10' : 'border-edge bg-panel2'
                      }`}
                    >
                      <button onClick={() => open(p)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <div className="text-sm font-medium truncate">{p.title}</div>
                        <div className="text-[11px] text-gray-500">Updated {fmt(p.updated_at)}</div>
                      </button>
                      <button onClick={() => rename(p)} disabled={busy} title="Rename" className="btn btn-icon h-7 w-7 text-xs">✎</button>
                      <button onClick={() => dup(p)} disabled={busy} title="Duplicate" className="btn btn-icon h-7 w-7 text-xs">⧉</button>
                      <button onClick={() => del(p)} disabled={busy} title="Delete" className="btn btn-icon h-7 w-7 text-xs hover:text-red-400 hover:border-red-500/60">🗑</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}
