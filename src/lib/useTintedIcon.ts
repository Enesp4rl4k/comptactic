import { useEffect, useState } from 'react'

// The blue icon variant uses these body colors; everything else (dark outlines)
// is preserved so the tinted icon keeps its definition on busy maps.
const BODY_COLORS = [/#04a0d8/gi, /#14c4ff/gi]

const textCache = new Map<string, Promise<string>>()
const imgCache = new Map<string, HTMLImageElement>()

function loadSvgText(url: string): Promise<string> {
  let p = textCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => r.text())
    textCache.set(url, p)
  }
  return p
}

/** Loads an icon SVG and recolors its body to `color`, returning a decoded image. */
export function useTintedIcon(url: string | null, color: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!url) {
      setImg(null)
      return
    }
    const key = url + '|' + color
    const cached = imgCache.get(key)
    if (cached) {
      setImg(cached)
      return
    }
    let active = true
    loadSvgText(url).then((text) => {
      if (!active) return
      let tinted = text
      for (const re of BODY_COLORS) tinted = tinted.replace(re, color)
      const blobUrl = URL.createObjectURL(new Blob([tinted], { type: 'image/svg+xml' }))
      const image = new window.Image()
      image.onload = () => {
        URL.revokeObjectURL(blobUrl)
        imgCache.set(key, image)
        if (active) setImg(image)
      }
      image.onerror = () => URL.revokeObjectURL(blobUrl)
      image.src = blobUrl
    })
    return () => {
      active = false
    }
  }, [url, color])

  return img
}
