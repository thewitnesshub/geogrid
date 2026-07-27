import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { BASEMAP_GROUPS } from '../../lib/basemaps'
import { useGrid } from '../../state/GridStore'

const LayersIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)

export function BasemapControl() {
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

  return (
    <div className={styles.ctl} ref={wrap}>
      <button
        className={`${styles.chromeBtn} ${open ? styles.active : ''}`}
        type="button"
        data-tip="Choose basemap"
        data-tip-key="M"
        aria-label="Choose basemap"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {LayersIcon}
      </button>

      <div className={`${styles.dropPanel} ${styles.basemapPanel} ${open ? styles.open : ''}`}>
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
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
