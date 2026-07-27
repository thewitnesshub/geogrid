import { pickFirstRun } from './firstRun'
import type { ThemeChoice } from './types'

const VIEW_KEY = 'geogrid.view'
const THEME_KEY = 'geogrid.theme'

export interface SavedView {
  center: [number, number]
  zoom: number
}

/** typeof first: isFinite(null) is true, so a null would slip a NaN centre through. */
const num = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

/**
 * Reopen where you left off. Only the view is remembered — the grid itself is
 * not, so a new session starts clean but over the same ground. With nothing
 * stored, a random landmark stands in.
 */
export function readStartView(): SavedView {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null')
    if (
      saved &&
      num(saved.lat) &&
      num(saved.lng) &&
      num(saved.zoom) &&
      Math.abs(saved.lat) <= 90 &&
      Math.abs(saved.lng) <= 180
    ) {
      return { center: [saved.lat, saved.lng], zoom: Math.max(1, Math.min(19, saved.zoom)) }
    }
  } catch {
    /* unreadable storage is the same as no storage */
  }
  const p = pickFirstRun()
  return { center: [p.lat, p.lng], zoom: p.z }
}

export function writeView(lat: number, lng: number, zoom: number) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ lat, lng, zoom }))
  } catch {
    /* private mode — the view simply is not remembered */
  }
}

export function readTheme(): ThemeChoice {
  try {
    return (localStorage.getItem(THEME_KEY) as ThemeChoice) || 'system'
  } catch {
    return 'system'
  }
}

export function writeTheme(t: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignore */
  }
}
