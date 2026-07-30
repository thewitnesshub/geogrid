import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { BASEMAP_GROUPS, BASEMAP_SHORT, SENTINEL_ID } from '../../lib/basemaps'
import { useGrid } from '../../state/GridStore'
import { DateControl } from '../overlay/Overlays'
import type { DatedEntry } from '../../lib/datedSources'

interface Props {
  /** Non-null only while a dated source is armed; it then rides in the island. */
  dated: { entries: DatedEntry[]; meta: string; index: number } | null
  onIndex: (i: number) => void
}

/* Lucide's satellite — a body between two canted solar panels. Google Earth
   parks this control in the bottom-left corner, and the glyph says what the
   button is for in a way the stack of plates never did: you are choosing whose
   pictures you are looking at. It stays the same drawing whichever source is
   armed — the caption underneath is what changes. Six of the ten sources are
   not a satellite at all (three OSM styles, streets, topo, an Esri mosaic), so
   a per-source drawing would have nothing to draw for half the menu, and a
   button whose glyph moves is a button you can no longer find by shape. */
const SatelliteIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 7 9 3 5 7l4 4" />
    <path d="m17 11 4 4-4 4-4-4" />
    <path d="m8 12 4 4 6-6-4-4Z" />
    <path d="m16 8 3-3" />
    <path d="M9 21a6 6 0 0 0-6-6" />
  </svg>
)

export function BasemapPicker(p: Props) {
  const g = useGrid()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [open])

  // Focus mode hides this island. A menu left open behind it is invisible but
  // still listening, and the Escape that should bring the chrome back would be
  // spent closing something no one can see.
  useEffect(() => {
    if (g.focus) setOpen(false)
  }, [g.focus])

  // Escape shuts the menu before the app-wide Escape puts a tool down — the
  // same staged retreat the rail's confirm and the region search already use.
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [open])

  return (
    <div className={`${styles.baseIsland} app-chrome`} ref={wrap}>
      <button
        className={`${styles.baseBtn} ${open ? styles.active : ''}`}
        type="button"
        data-tip="Choose basemap"
        data-tip-key="M"
        aria-label="Choose basemap"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {SatelliteIcon}
        {/* What you are looking at, named on the face of the button. */}
        <span className={styles.baseName}>{BASEMAP_SHORT[g.base] ?? g.base}</span>
      </button>

      {/* A dated source extends the island rightward rather than opening a
          second box: which pass you are on is part of what you are looking at,
          not a separate question. */}
      {p.dated && (
        <>
          <div className={styles.railDiv} />
          <DateControl state={p.dated} onIndex={p.onIndex} />
        </>
      )}

      <div className={`${styles.basePanel} ${open ? styles.open : ''}`}>
        {BASEMAP_GROUPS.map((grp) => (
          <div key={grp.group}>
            <div className={styles.bmGroup}>{grp.group}</div>
            {grp.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={g.base === o.id ? styles.active : ''}
                onClick={() => {
                  g.setBase(o.id)
                  setOpen(false)
                }}
              >
                {o.label}
                {/* Sentinel is the one basemap with its own key, so it is the
                    one row that carries a chip — the menu is where you learn it. */}
                {o.id === SENTINEL_ID && <span className={styles.menuKey}>S</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
