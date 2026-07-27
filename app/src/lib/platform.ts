// case-insensitive on purpose: userAgentData.platform reports "macOS",
// navigator.platform reports "MacIntel"
const APPLE = /mac|iphone|ipad|ipod/i.test(
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent,
)

/** The modifier that paints. Wired as metaKey||ctrlKey; this is just the label. */
export const PAINT_KEY = APPLE ? '⌘' : 'Ctrl'

/** A touch device has no modifier at all, so hints about one are held back. */
export const HAS_MOUSE = window.matchMedia('(hover:hover) and (pointer:fine)').matches

export const GRID_COLORS = [
  { hex: '#2dd4bf', name: 'Teal' },
  { hex: '#f0883e', name: 'Orange' },
  { hex: '#38bdf8', name: 'Cyan' },
  { hex: '#f472b6', name: 'Pink' },
  { hex: '#facc15', name: 'Yellow' },
  { hex: '#a78bfa', name: 'Violet' },
  { hex: '#ffffff', name: 'White' },
]

export const DEFAULT_GRID_COLOR = '#facc15'
