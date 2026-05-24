import { useEffect, useRef } from 'react'

/** Run `fn` at most once per animation frame (keeps UI smooth during drag/draw). */
export function useRafThrottle<T extends (...args: never[]) => void>(fn: T): T {
  const fnRef = useRef(fn)
  const rafRef = useRef<number | null>(null)
  const argsRef = useRef<Parameters<T> | null>(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  return ((...args: Parameters<T>) => {
    argsRef.current = args
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const a = argsRef.current
      if (a) fnRef.current(...a)
    })
  }) as T
}
