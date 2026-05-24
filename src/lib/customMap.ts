import type { CustomMapMeta } from '../types'
import { canUploadImage, uploadPlanImage } from './storage'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_EDGE = 4096
const DEFAULT_SIZE_METERS = 4000

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp']

export interface CustomMapImportResult {
  url: string
  name: string
  meta: CustomMapMeta
  /** True when stored as a data URL (won't sync in collab until signed in + uploaded). */
  localOnly: boolean
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

/** Downscale very large images so autosave / memory stay reasonable. */
async function maybeResize(file: File): Promise<File> {
  const { width, height } = await readImageDimensions(file)
  const maxEdge = Math.max(width, height)
  if (maxEdge <= MAX_EDGE) return file

  const scale = MAX_EDGE / maxEdge
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), file.type || 'image/png', 0.92),
  )
  if (!blob) return file
  return new File([blob], file.name, { type: blob.type })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function isImageFile(file: File): boolean {
  return ACCEPT.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
}

/**
 * Import a user-supplied map image: optional resize, upload when signed in,
 * otherwise embed as a data URL.
 */
export async function importCustomMap(file: File, sizeMeters = DEFAULT_SIZE_METERS): Promise<CustomMapImportResult> {
  if (!isImageFile(file)) throw new Error('Use a PNG, JPEG, or WebP image.')
  if (file.size > MAX_BYTES) throw new Error('Image must be under 8 MB.')

  const prepared = await maybeResize(file)
  const { width, height } = await readImageDimensions(prepared)
  const meta: CustomMapMeta = {
    sizeMeters,
    naturalWidth: width,
    naturalHeight: height,
  }

  if (await canUploadImage()) {
    try {
      const url = await uploadPlanImage(prepared)
      return { url, name: file.name, meta, localOnly: false }
    } catch {
      /* fall through to local */
    }
  }

  const url = await readFileAsDataUrl(prepared)
  return { url, name: file.name, meta, localOnly: true }
}
