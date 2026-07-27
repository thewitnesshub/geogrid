import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { useGrid } from '../../state/GridStore'
import { ColorFlyout } from './ColorFlyout'
import { RegionPopover } from './RegionPopover'
import { fmtSize, kmToSlider, sliderToKm } from '../../lib/gridMath'
import { HAS_MOUSE, PAINT_KEY } from '../../lib/platform'

type Pop = null | 'region' | 'size'

const GridIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
)
const SearchIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const GearIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)
const BrushIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
  </svg>
)
const TrashIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)
const FocusIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)

export function Toolbox() {
  const g = useGrid()
  const [pop, setPop] = useState<Pop>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const hasGrid = g.cells.length > 0
  const regenT = useRef<{ t: number | undefined; last: number }>({ t: undefined, last: 0 })

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setPop(null)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [])

  // A grid that vanishes takes its settings popover with it.
  useEffect(() => {
    if (!hasGrid && pop === 'size') setPop(null)
  }, [hasGrid, pop])

  /** leading + trailing throttle (~70ms) so dragging the slider stays smooth */
  const liveRegen = () => {
    window.clearTimeout(regenT.current.t)
    const now = Date.now()
    if (now - regenT.current.last > 70) {
      regenT.current.last = now
      g.actions.current?.generate()
    } else {
      regenT.current.t = window.setTimeout(() => {
        regenT.current.last = Date.now()
        g.actions.current?.generate()
      }, 90)
    }
  }

  return (
    <div className={`${styles.toolbox} app-chrome`} ref={box}>
      <button
        className={`${styles.railBtn} ${g.drawing ? styles.active : ''}`}
        type="button"
        data-tip="Draw a search box"
        data-tip-key="D"
        aria-label="Draw a search box"
        onClick={() => {
          setPop(null)
          g.setDrawing(!g.drawing)
        }}
      >
        {GridIcon}
      </button>

      <div className={styles.railItem}>
        <button
          className={`${styles.railBtn} ${pop === 'region' ? styles.active : ''}`}
          type="button"
          data-tip="Fill a region"
          data-tip-key="R"
          aria-label="Fill a region"
          onClick={() => setPop(pop === 'region' ? null : 'region')}
        >
          {SearchIcon}
        </button>
        <RegionPopover open={pop === 'region'} onDone={() => setPop(null)} />
      </div>

      <div className={styles.railItem}>
        <button
          className={`${styles.railBtn} ${pop === 'size' ? styles.active : ''}`}
          type="button"
          disabled={!hasGrid}
          data-tip="Cell size"
          data-tip-key="C"
          aria-label="Cell size"
          onClick={() => setPop(pop === 'size' ? null : 'size')}
        >
          {GearIcon}
        </button>

        <div className={`${styles.railPop} ${pop === 'size' ? styles.open : ''}`}>
          <div className={styles.railPopCols}>
            <div className={styles.sliderCol}>
              <div className={styles.railPopTop}>
                <span>Cell size</span>
                <span className={styles.cellSizeVal}>{fmtSize(g.cellKm)}</span>
              </div>
              <div className={styles.sliderRow}>
                <span className={styles.sliderEnd}>100 m</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={kmToSlider(g.cellKm)}
                  aria-label="Cell size"
                  onChange={(e) => {
                    g.setCellKm(sliderToKm(parseFloat(e.target.value)))
                    liveRegen()
                  }}
                />
                <span className={styles.sliderEnd}>10 km</span>
              </div>
            </div>
            <div className={styles.colorCol}>
              <ColorFlyout />
            </div>
          </div>
        </div>
      </div>

      <button
        className={`${styles.railBtn} ${g.paintArmed ? styles.active : ''}`}
        type="button"
        disabled={!hasGrid}
        data-tip={g.paintArmed ? 'Painting — click to stop' : 'Brush over cells'}
        data-tip-key="B"
        aria-label={`Brush over cells${HAS_MOUSE ? ` — or hold ${PAINT_KEY} and drag` : ''}`}
        onClick={() => {
          setPop(null)
          g.setPaintArmed(!g.paintArmed)
        }}
      >
        {BrushIcon}
      </button>

      <button
        className={`${styles.railBtn} ${styles.clearBtn}`}
        type="button"
        disabled={!hasGrid && !g.areaBounds}
        data-tip="Clear grid"
        aria-label="Clear grid"
        onClick={() => {
          setPop(null)
          g.actions.current?.clearAll()
        }}
      >
        {TrashIcon}
      </button>

      <div className={styles.railDiv} />

      <button
        className={styles.railBtn}
        type="button"
        data-tip="Focus mode — hide all controls"
        data-tip-key="F"
        aria-label="Focus mode"
        onClick={() => g.setFocus(true)}
      >
        {FocusIcon}
      </button>
    </div>
  )
}
