import { useEffect } from 'react'
import { HAS_MOUSE, PAINT_KEY } from '../lib/platform'

export interface ShortcutHandlers {
  draw: () => void
  polygon: () => void
  region: () => void
  size: () => void
  brush: () => void
  eraser: () => void
  basemap: () => void
  sentinel: () => void
  exportKml: () => void
  focus: () => void
  search: () => void
  shortcuts: () => void
  escape: () => void
}

/**
 * One table drives the key handler and the help modal, so the documentation
 * cannot drift from what the keys actually do. Clearing the grid is
 * deliberately absent: it is destructive and has no undo, which is not
 * something a single stray keystroke should be able to do.
 */
const KEYS: { key: string; run: keyof ShortcutHandlers }[] = [
  { key: 'd', run: 'draw' },
  { key: 'v', run: 'polygon' },
  { key: 'r', run: 'region' },
  { key: 'c', run: 'size' },
  { key: 'b', run: 'brush' },
  { key: 'x', run: 'eraser' },
  { key: 'm', run: 'basemap' },
  { key: 's', run: 'sentinel' },
  { key: 'e', run: 'exportKml' },
  { key: 'f', run: 'focus' },
  { key: '/', run: 'search' },
  { key: '?', run: 'shortcuts' },
]

export function useShortcuts(h: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        h.escape()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '')) return
      const hit = KEYS.find((k) => k.key.toLowerCase() === e.key.toLowerCase())
      if (hit) {
        e.preventDefault()
        h[hit.run]()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [h, enabled])
}

/** `caps` spells out the chips, so a mouse gesture stays one chip. */
export function SHORTCUT_DOC() {
  return [
    {
      group: 'Tools',
      rows: [
        { label: 'Draw a search box', caps: ['D'] },
        { label: 'Draw a custom grid area', caps: ['V'] },
        { label: 'Fill a region', caps: ['R'] },
        { label: 'Cell size & colour', caps: ['C'] },
        { label: 'Brush over cells', caps: ['B'] },
        { label: 'Erase cells', caps: ['X'] },
        ...(HAS_MOUSE
          ? [{ label: 'Brush without leaving the current tool', caps: [PAINT_KEY, 'drag'] }]
          : []),
        { label: 'Pin, or copy coordinates', caps: ['Right click'] },
      ],
    },
    {
      group: 'Map',
      rows: [
        { label: 'Basemap picker', caps: ['M'] },
        { label: 'Sentinel-2 imagery, and back', caps: ['S'] },
        { label: 'Export to KML', caps: ['E'] },
        { label: 'Focus mode', caps: ['F'] },
        { label: 'Search a place', caps: ['/'] },
      ],
    },
    {
      group: 'General',
      rows: [
        { label: 'This shortcut list', caps: ['?'] },
        { label: 'Put down the tool, close a panel, leave focus mode', caps: ['Esc'] },
      ],
    },
  ]
}
