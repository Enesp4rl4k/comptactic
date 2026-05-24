import { useEffect, useState, type RefObject } from 'react'

export const MAP_SIZE = 1024

/** Track container size and fit the 1024×1024 map square into view. */
export function useBoardViewport(
  containerRef: RefObject<HTMLDivElement | null>,
  mapKey: string | null,
) {
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [containerRef])

  useEffect(() => {
    if (!size.w) return
    const scale = Math.min(size.w / MAP_SIZE, size.h / MAP_SIZE) * 0.92
    setView({
      x: (size.w - MAP_SIZE * scale) / 2,
      y: (size.h - MAP_SIZE * scale) / 2,
      scale,
    })
  }, [mapKey, size.w, size.h])

  return { size, view, setView }
}
