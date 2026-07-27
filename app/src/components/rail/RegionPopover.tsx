import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { useGrid } from '../../state/GridStore'
import { useToast } from '../../hooks/useToast'
import { splitName } from '../../lib/geo'
import type { Polygon, MultiPolygon } from 'geojson'

interface Hit {
  label: string
  sub: string
  geo: Polygon | MultiPolygon
}

/**
 * Fill a region's real shape. Same shape as the place search above, but these
 * results are boundaries rather than points, and the list opens upward because
 * the rail sits at the bottom.
 */
export function RegionPopover({ open, onDone }: { open: boolean; onDone: () => void }) {
  const g = useGrid()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Hit[]>([])
  const [active, setActive] = useState(-1)
  const [note, setNote] = useState('')
  const abort = useRef<AbortController | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const input = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  const close = () => {
    setItems([])
    setActive(-1)
    setNote('')
  }

  const search = (text: string) => {
    abort.current?.abort()
    abort.current = new AbortController()
    setNote('Searching…')
    // Ask for the outline pre-simplified. Full detail on a big region runs to
    // megabytes, and none of it survives being cut into cells: the tolerance is
    // ~22 m, well inside the 100 m smallest cell.
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&polygon_threshold=0.0002&limit=8&q=${encodeURIComponent(text)}`,
      { signal: abort.current.signal },
    )
      .then((r) => r.json())
      .then((list: any[]) => {
        const hits: Hit[] = (list ?? [])
          .filter((d) => d.geojson && (d.geojson.type === 'Polygon' || d.geojson.type === 'MultiPolygon'))
          .map((d) => ({ ...splitName(d.display_name), geo: d.geojson }))
        setItems(hits)
        setNote(hits.length ? '' : 'No area boundary found — try a city, district or region.')
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setNote('Region lookup failed (network).')
      })
  }

  const pick = (h: Hit) => {
    close()
    setQ(h.label)
    g.actions.current?.setRegion(h.geo, h.sub)
    toast(`Filled ${h.label}`)
    onDone()
  }

  return (
    <div className={`${styles.railPop} ${open ? styles.open : ''}`}>
      <div className={styles.railPopLabel}>Fill a region&rsquo;s real shape</div>
      <div className={styles.regionWrap}>
        <input
          ref={input}
          className={styles.regionInput}
          type="text"
          value={q}
          placeholder="Search a city or region…"
          autoComplete="off"
          aria-label="Region name"
          onChange={(e) => {
            setQ(e.target.value)
            setActive(-1)
            window.clearTimeout(timer.current)
            if (e.target.value.trim().length < 3) return close()
            const v = e.target.value.trim()
            timer.current = window.setTimeout(() => search(v), 350)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && items.length) {
              e.preventDefault()
              setActive((a) => (a + 1) % items.length)
            } else if (e.key === 'ArrowUp' && items.length) {
              e.preventDefault()
              setActive((a) => (a - 1 + items.length) % items.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (active >= 0 && items[active]) pick(items[active])
            } else if (e.key === 'Escape') {
              close()
            }
          }}
        />
        <div className={`${styles.suggest} ${items.length || note ? styles.open : ''}`}>
          {items.map((h, i) => (
            <div
              key={`${h.label}-${i}`}
              className={`${styles.suggestItem} ${i === active ? styles.active : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
            >
              {h.label}
              {h.sub && <span className={styles.sub}>{h.sub}</span>}
            </div>
          ))}
          {note && <div className={styles.suggestNote}>{note}</div>}
        </div>
      </div>
    </div>
  )
}
