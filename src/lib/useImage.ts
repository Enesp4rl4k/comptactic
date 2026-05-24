import { useEffect, useState } from 'react'
import { loadCachedImage, peekCachedImage } from './imageCache'

type Status = 'loading' | 'loaded' | 'failed'

/** Minimal image loader for Konva. Uses a shared decode cache per URL. */
export function useImage(src: string | null): [HTMLImageElement | null, Status] {
  const cached = src ? peekCachedImage(src) : null
  const [img, setImg] = useState<HTMLImageElement | null>(cached)
  const [status, setStatus] = useState<Status>(cached ? 'loaded' : src ? 'loading' : 'failed')

  useEffect(() => {
    if (!src) {
      setImg(null)
      setStatus('failed')
      return
    }
    const hit = peekCachedImage(src)
    if (hit) {
      setImg(hit)
      setStatus('loaded')
      return
    }
    let active = true
    setStatus('loading')
    loadCachedImage(src)
      .then((image) => {
        if (!active) return
        setImg(image)
        setStatus('loaded')
      })
      .catch(() => {
        if (!active) return
        setImg(null)
        setStatus('failed')
      })
    return () => {
      active = false
    }
  }, [src])

  return [img, status]
}
