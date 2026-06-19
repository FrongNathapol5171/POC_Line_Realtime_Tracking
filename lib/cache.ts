/**
 * Module-level in-memory cache.
 * Works within a single Node.js process instance (dev + single Vercel lambda warm start).
 */

import { Clinic } from './types'

interface CacheEntry<T> { data: T; expiresAt: number }

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry || Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.data
}

export function cacheSet<T>(key: string, data: T, ttlMs: number) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function cacheDel(key: string) { store.delete(key) }

// ── Typed helpers ──────────────────────────────────────────────

const CLINIC_KEY = 'clinics'
const CLINIC_TTL = 5 * 60 * 1000    // 5 minutes

export function getCachedClinics(): Clinic[] | null  { return cacheGet<Clinic[]>(CLINIC_KEY) }
export function setCachedClinics(c: Clinic[])         { cacheSet(CLINIC_KEY, c, CLINIC_TTL) }
export function invalidateClinics()                    { cacheDel(CLINIC_KEY) }

// Sheet tab → numeric sheetId cache (rarely changes)
const SHEET_ID_KEY = (name: string) => `sheetId:${name}`

export function getCachedSheetId(name: string): number | null { return cacheGet<number>(SHEET_ID_KEY(name)) }
export function setCachedSheetId(name: string, id: number)    { cacheSet(SHEET_ID_KEY(name), id, 60 * 60 * 1000) }
