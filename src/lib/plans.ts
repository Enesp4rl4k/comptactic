import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import type { BoardSnapshot } from '../types'

export interface PlanRow {
  id: string
  title: string
  created_at: string
  updated_at: string
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/** List the current user's plans (newest first). */
export async function listPlans(): Promise<PlanRow[]> {
  const { data, error } = await client()
    .from('plans')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Load a single plan's title + snapshot. */
export async function getPlan(id: string): Promise<{ title: string; data: BoardSnapshot }> {
  const { data, error } = await client().from('plans').select('title, data').eq('id', id).single()
  if (error) throw error
  return { title: data.title, data: data.data as BoardSnapshot }
}

/** Create a new plan owned by the current user; returns its id. */
export async function createPlan(title: string, data: BoardSnapshot): Promise<string> {
  const sb = client()
  const { data: auth } = await sb.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('You must be signed in.')
  const { data: row, error } = await sb
    .from('plans')
    .insert({ title, data, user_id: userId })
    .select('id')
    .single()
  if (error) throw error
  return row.id as string
}

/** Update an existing plan's title and/or snapshot. */
export async function updatePlan(id: string, patch: { title?: string; data?: BoardSnapshot }): Promise<void> {
  const { error } = await client().from('plans').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await client().from('plans').delete().eq('id', id)
  if (error) throw error
}

/** Duplicate a plan; returns the new plan id. */
export async function duplicatePlan(id: string): Promise<string> {
  const { title, data } = await getPlan(id)
  return createPlan(`${title} (copy)`, data)
}

// --- short share links (public, anyone can create/read by id) ---

export async function createShare(data: BoardSnapshot, expiresInDays = 30): Promise<string> {
  const sb = client()
  const { data: auth } = await sb.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Sign in to create a share link.')
  const id = nanoid(10)
  const expires_at = new Date(Date.now() + expiresInDays * 864e5).toISOString()
  const { error } = await sb.from('shares').insert({ id, data, created_by: userId, expires_at })
  if (error) throw error
  return id
}

export async function getShare(id: string): Promise<BoardSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('shares').select('data').eq('id', id).single()
  if (error) return null
  return data.data as BoardSnapshot
}
