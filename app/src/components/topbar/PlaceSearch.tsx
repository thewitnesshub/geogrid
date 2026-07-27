import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { parseCoords } from '../../lib/geo'
import { useGrid } from '../../state/GridStore'

interface Hit {
  label: string
  sub: string
  lat: number
  lng: number
  bbox: [number, number, number, number] | null
}

const SearchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

/**
 * Place or coordinates. A coordinate pair is answered locally — nothing needs
 * looking up when we can already parse it.
 */
export function PlaceSearch({ onDone }: { onDone: () => void }) {
  const g = useGrid()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Hit[]>([])
  const [active, setActive] = useState(-1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const abort = useRef<AbortController | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const close = () => {
    setItems([])
    setActive(-1)
    setNote('')
  }

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [])

  const search = (text: string) => {
    abort.current?.abort()
    abort.current = new AbortController()
    setNote('Searching…')
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(text)}`,
      { signal: abort.current.signal },
    )
      .then((r) => r.json())
      .then((list: any[]) => {
        const hits: Hit[] = (list ?? []).map((d) => ({
          label: d.display_name.split(',')[0],
          sub: d.display_name,
          lat: +d.lat,
          lng: +d.lon,
          bbox: d.boundingbox ? (d.boundingbox.map(parseFloat) as Hit['bbox']) : null,
        }))
        setItems(hits)
        setNote(hits.length ? '' : 'No matches.')
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setNote('Lookup failed.')
      })
  }

  const onChange = (v: string) => {
    setQ(v)
    setActive(-1)
    window.clearTimeout(timer.current)
    const coord = parseCoords(v.trim())
    if (coord) return close()
    if (v.trim().length < 3) return close()
    timer.current = window.setTimeout(() => search(v.trim()), 350)
  }

  const pick = (h: Hit) => {
    setQ(h.label)
    close()
    if (h.bbox) g.actions.current?.fitBounds([[h.bbox[0], h.bbox[2]], [h.bbox[1], h.bbox[3]]])
    else g.actions.current?.flyTo(h.lat, h.lng, 14)
    onDone()
  }

  const go = async () => {
    const text = q.trim()
    close()
    if (!text) return
    const coord = parseCoords(text)
    if (coord) {
      const map = g.mapRef.current
      g.actions.current?.flyTo(coord[0], coord[1], Math.max(map?.getZoom() ?? 15, 15))
      onDone()
      return
    }
    setBusy(true)
    try {
      const list = await (
        await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`,
        )
      ).json()
      if (list?.length) {
        const it = list[0]
        if (it.boundingbox) {
          const bb = it.boundingbox.map(parseFloat)
          g.actions.current?.fitBounds([[bb[0], bb[2]], [bb[1], bb[3]]])
        } else g.actions.current?.flyTo(+it.lat, +it.lon, 14)
        onDone()
      } else setNote(`No results for "${text}".`)
    } catch {
      setNote('Location search failed (network).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.searchBar} ref={box}>
      {SearchIcon}
      <input
        type="text"
        value={q}
        placeholder="Place or coordinates"
        autoComplete="off"
        aria-label="Place or coordinates"
        onChange={(e) => onChange(e.target.value)}
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
            else void go()
          } else if (e.key === 'Escape') {
            if (items.length || note) close()
            else onDone()
          }
        }}
      />
      <button className={styles.goBtn} type="button" onClick={() => void go()} disabled={busy}>
        {busy ? '…' : 'Go'}
      </button>

      <div className={`${styles.suggest} ${styles.suggestDown} ${items.length || note ? styles.open : ''}`}>
        {items.map((h, i) => (
          <div
            key={`${h.lat},${h.lng},${i}`}
            className={`${styles.suggestItem} ${i === active ? styles.active : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(h)}
          >
            {h.label}
            <span className="sub">{h.sub}</span>
          </div>
        ))}
        {note && <div className={styles.suggestNote}>{note}</div>}
      </div>
    </div>
  )
}
