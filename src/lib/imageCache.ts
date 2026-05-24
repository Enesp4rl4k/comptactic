type Entry = { img: HTMLImageElement; status: 'loading' | 'loaded' | 'failed' }

const cache = new Map<string, Entry>()
const waiters = new Map<string, Set<(e: Entry) => void>>()

function notify(url: string, entry: Entry) {
  waiters.get(url)?.forEach((cb) => cb(entry))
  waiters.delete(url)
}

/** Shared decoded map image cache — avoids reloading the same minimap URL. */
export function loadCachedImage(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src)
  if (hit?.status === 'loaded') return Promise.resolve(hit.img)
  if (hit?.status === 'failed') return Promise.reject(new Error('Image failed'))

  return new Promise((resolve, reject) => {
    const onDone = (e: Entry) => {
      if (e.status === 'loaded') resolve(e.img)
      else reject(new Error('Image failed'))
    }
    if (!waiters.has(src)) waiters.set(src, new Set())
    waiters.get(src)!.add(onDone)

    if (hit?.status === 'loading') return

    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    const entry: Entry = { img: image, status: 'loading' }
    cache.set(src, entry)

    image.onload = () => {
      entry.status = 'loaded'
      notify(src, entry)
    }
    image.onerror = () => {
      entry.status = 'failed'
      cache.delete(src)
      notify(src, entry)
    }
    image.src = src
  })
}

export function peekCachedImage(src: string | null): HTMLImageElement | null {
  if (!src) return null
  const hit = cache.get(src)
  return hit?.status === 'loaded' ? hit.img : null
}
