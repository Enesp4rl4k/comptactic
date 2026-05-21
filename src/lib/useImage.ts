import { useEffect, useState } from 'react'

type Status = 'loading' | 'loaded' | 'failed'

/** Minimal image loader for Konva. Returns the element only once decoded. */
export function useImage(src: string | null): [HTMLImageElement | null, Status] {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!src) {
      setImg(null)
      setStatus('failed')
      return
    }
    setStatus('loading')
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    let active = true
    image.onload = () => {
      if (!active) return
      setImg(image)
      setStatus('loaded')
    }
    image.onerror = () => {
      if (!active) return
      setImg(null)
      setStatus('failed')
    }
    image.src = src
    return () => {
      active = false
    }
  }, [src])

  return [img, status]
}
