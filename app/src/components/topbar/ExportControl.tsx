import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { useGrid } from '../../state/GridStore'
import { buildKML } from '../../lib/kml'
import { useToast } from '../../hooks/useToast'

const DownIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export function ExportControl() {
  const g = useGrid()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  // Pins alone are worth exporting too.
  const any = g.cells.length > 0 || g.pins.length > 0
  /**
   * Built when asked for, not when the marks change. Holding it in a memo
   * meant every single cell you marked rebuilt the whole document — most of a
   * megabyte of string for a 3000-cell grid — and nothing read it until you
   * opened this menu. On a phone that is the pause between tapping a cell and
   * being able to move the map again.
   */
  const kml = () => (any ? buildKML(g.cells, g.pins, g.gridColor) : '')

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [open])

  const download = () => {
    const blob = new Blob([kml()], { type: 'application/vnd.google-earth.kml+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'geogrid.kml'
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Downloaded geogrid.kml')
    setOpen(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(kml())
      toast('KML copied to clipboard')
      setOpen(false)
    } catch {
      toast('Copy failed')
    }
  }

  return (
    <div className={styles.ctl} ref={wrap}>
      <button
        className={`${styles.chromeBtn} ${open ? styles.active : ''}`}
        type="button"
        disabled={!any}
        data-tip="Export to KML"
        data-tip-key="E"
        aria-label="Export to KML"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {DownIcon}
      </button>

      <div className={`${styles.dropPanel} ${styles.exportPanel} ${open ? styles.open : ''}`}>
        <button className={styles.primary} type="button" onClick={download}>
          ⬇ Download .kml
        </button>
        <button type="button" onClick={() => void copy()}>
          ⧉ Copy KML
        </button>
        <div className={styles.exportHint}>
          Import into Google Earth. Searched and to-search cells land in separate folders.
        </div>
      </div>
    </div>
  )
}
