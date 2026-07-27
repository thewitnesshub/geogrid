import { useEffect, useRef } from 'react'
import type { LatLng } from 'leaflet'
import { earthUrl, fmtLatLng, sentinelUrl } from '../../lib/geo'
import styles from '../../theme/chrome.module.css'

export interface CtxTarget {
  latlng: LatLng
  x: number
  y: number
}

interface Props {
  target: CtxTarget
  zoom: number
  onClose: () => void
  onPin: () => void
  onCopy: () => void
}

const PinIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const CopyIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)
const EarthIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
  </svg>
)
const SentinelIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 6a6 6 0 1 0 6 6" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="m16.5 3.5 4 4" />
  </svg>
)

export function ContextMenu({ target, zoom, onClose, onPin, onCopy }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Flip against the near edge rather than spilling off it.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wrap = el.parentElement?.getBoundingClientRect()
    if (!wrap) return
    let x = target.x
    let y = target.y
    if (x + el.offsetWidth > wrap.width - 8) x = wrap.width - el.offsetWidth - 8
    if (y + el.offsetHeight > wrap.height - 8) y -= el.offsetHeight
    el.style.left = `${Math.max(8, x)}px`
    el.style.top = `${Math.max(8, y)}px`
  }, [target])

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // defer: the very click that opened this must not also close it
    const t = window.setTimeout(() => document.addEventListener('click', away), 0)
    document.addEventListener('keydown', esc)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const go = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div ref={ref} className={styles.ctxMenu} role="menu">
      <div className={styles.ctxCoords}>{fmtLatLng(target.latlng)}</div>
      <button className={styles.ctxItem} type="button" onClick={go(onPin)}>
        {PinIcon}
        Drop a pin here
      </button>
      <button className={styles.ctxItem} type="button" onClick={go(onCopy)}>
        {CopyIcon}
        Copy coordinates
      </button>
      <button
        className={styles.ctxItem}
        type="button"
        onClick={go(() => window.open(earthUrl(target.latlng), '_blank', 'noopener'))}
      >
        {EarthIcon}
        Open in Google Earth
      </button>
      <button
        className={styles.ctxItem}
        type="button"
        onClick={go(() => window.open(sentinelUrl(target.latlng, zoom), '_blank', 'noopener'))}
      >
        {SentinelIcon}
        Open in Copernicus (Sentinel)
      </button>
    </div>
  )
}
