import { nanoid } from 'nanoid'
import { supabase } from './supabase'

const BUCKET = 'plan-images'

/** True when an uploaded image (Storage) is possible: configured + signed in. */
export async function canUploadImage(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return !!data.user
}

/** Upload a background image to Storage; returns its public URL. Requires sign-in. */
export async function uploadPlanImage(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('Sign in to upload images.')
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${uid}/${nanoid(10)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
