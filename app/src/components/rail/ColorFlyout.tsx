import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { GRID_COLORS } from '../../lib/platform'
import { useGrid } from '../../state/GridStore'

/**
 * One swatch showing the current colour; the palette lives in a flyout centred
 * on that swatch. The swatch sits near the popover's right edge, so on the
 * narrowest phones the centred position would run off screen — the nudge pulls
 * it back only when it actually would.
 */
export function ColorFlyout() {
  const g = useGrid()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement | null>(null)
  const fly = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const el = fly.current
    if (el) {
      el.style.setProperty('--fly-shift', '0px')
      const r = el.getBoundingClientRect()
      const pad = 8
      let shift = 0
      if (r.right > window.innerWidth - pad) shift = window.innerWidth - pad - r.right
      else if (r.left < pad) shift = pad - r.left
      if (shift) el.style.setProperty('--fly-shift', `${Math.round(shift)}px`)
    }
    const away = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [open])

  return (
    <div className={styles.swAnchor} ref={anchor}>
      <button
        className={styles.swCurrent}
        style={{ background: g.gridColor }}
        type="button"
        data-tip="Choose grid colour"
        aria-label="Choose grid colour"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      />
      <div ref={fly} className={`${styles.colorFlyout} ${open ? styles.open : ''}`}>
        <div className={styles.swRow}>
          {GRID_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`${styles.swBtn} ${g.gridColor === c.hex ? styles.active : ''}`}
              style={{ background: c.hex }}
              title={c.name}
              aria-label={c.name}
              onClick={() => {
                g.setGridColor(c.hex)
                setOpen(false)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
