import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { useGrid } from '../../state/GridStore'
import { ColorFlyout } from './ColorFlyout'
import { RegionPopover } from './RegionPopover'
import { fmtSize, kmToSlider, maxSliderPos, minSliderPos, sliderToKm } from '../../lib/gridMath'
import { HAS_MOUSE, PAINT_KEY } from '../../lib/platform'

type Pop = null | 'region' | 'size' | 'clear'

/* Lucide's grid-2x2-plus, which is the family the rest of this rail already
   draws from. The button makes a grid rather than toggling one, and a plain
   grid glyph only said "grid" — the plus says you are about to add one. */
const GridIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3" />
    <path d="M16 19h6" />
    <path d="M19 22v-6" />
  </svg>
)
const PolygonGridIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
    <path d="M12 3v9" />
    <path d="M12 12h9" />
    <path d="M16 19h6" />
    <path d="M19 22v-6" />
    <g fill="#000" stroke="#000">
      <circle cx="12" cy="21" r="1.2" />
    </g>
  </svg>
)
/* Not a Lucide icon — grid-2x2-plus with the plus swapped for a magnifier, so
   the two tools that make a grid read as a pair: one draws the area, one looks
   it up. The frame is grid-2x2-plus's own path, unchanged, so the only thing
   that differs between the two buttons is the mark in the empty quadrant. A
   bare magnifier here said "search" and nothing about a grid, which is also
   what the place search in the top bar says. */
const SearchIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3" />
    <circle cx="17.5" cy="17.5" r="2.5" />
    <path d="m19.5 19.5 2.5 2.5" />
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
const EraserIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 20.5 3.8 15.8a2 2 0 0 1 0-2.83l8.9-8.9a2 2 0 0 1 2.83 0l4.7 4.7a2 2 0 0 1 0 2.83L12.5 20.5z" />
    <path d="M8.5 20.5H21" /><path d="m9.4 8.6 6 6" />
  </svg>
)
const EraserSmall = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 20.5 3.8 15.8a2 2 0 0 1 0-2.83l8.9-8.9a2 2 0 0 1 2.83 0l4.7 4.7a2 2 0 0 1 0 2.83L12.5 20.5z" />
    <path d="M8.5 20.5H21" />
  </svg>
)
const PinSmall = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
const TrashSmall = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
  // Read fresh on every open: a mark mutates the cell in place without a
  // re-render, and opening the clear popover is itself the render that reads it.
  const marked = g.cells.reduce((n, c) => n + (c.searched ? 1 : 0), 0)
  // The track covers only what this area can hold, so the thumb never springs
  // back: below the floor the grid breaks the cell cap, above the ceiling a
  // single cell no longer fits inside the area.
  const minPos = g.areaBounds ? minSliderPos(g.areaBounds) : 0
  const maxPos = g.areaBounds ? maxSliderPos(g.areaBounds) : 100
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

  // Escape backs out of the confirm, which is the other half of being able to
  // cancel it. Capture, so it answers before the app-wide Escape does.
  useEffect(() => {
    if (pop !== 'clear') return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setPop(null)
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [pop])

  // A new grid opens its settings: the cell size, which is the thing anyone
  // reaches for once the cells are on screen. The palette stays shut — the
  // swatch already shows the colour in use, and opening it unasked would cover
  // the grid you just made with the choices you did not ask to see.
  //
  // Driven by the grid epoch rather than by "are there cells now", so drawing a
  // box and filling a region do the same thing, and so replacing a grid opens
  // them again instead of only the first one ever doing it.
  //
  // Deferred a tick because drawing ends in a click on the map, and that click
  // reaches the dismiss-on-outside-click handlers below. Opening in the same
  // turn would be undone by the gesture that asked for it.
  useEffect(() => {
    if (!g.gridEpoch) return
    const t = window.setTimeout(() => setPop('size'), 0)
    return () => window.clearTimeout(t)
  }, [g.gridEpoch])

  /** leading + trailing throttle (~70ms) so dragging the slider stays smooth */
  const liveRegen = (km: number) => {
    window.clearTimeout(regenT.current.t)
    const now = Date.now()
    if (now - regenT.current.last > 70) {
      regenT.current.last = now
      g.actions.current?.generate(km)
    } else {
      regenT.current.t = window.setTimeout(() => {
        regenT.current.last = Date.now()
        g.actions.current?.generate(km)
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
          g.setPolygonDrawing(false)
          g.setPaintMode(null)
          g.setDrawing(!g.drawing)
        }}
      >
        {GridIcon}
      </button>

      <button
        className={`${styles.railBtn} ${g.polygonDrawing ? styles.active : ''}`}
        type="button"
        data-tip="Draw a custom grid area"
        data-tip-key="V"
        aria-label="Draw a custom grid area"
        onClick={() => {
          setPop(null)
          const on = !g.polygonDrawing
          g.setDrawing(false)
          g.setPaintMode(null)
          g.setPolygonDrawing(on)
        }}
      >
        {PolygonGridIcon}
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
                <span className={styles.sliderEnd}>{fmtSize(sliderToKm(minPos))}</span>
                <input
                  type="range"
                  min={minPos}
                  max={maxPos}
                  step={0.5}
                  value={Math.min(maxPos, Math.max(minPos, kmToSlider(g.cellKm)))}
                  aria-label="Cell size"
                  onChange={(e) => {
                    const km = sliderToKm(parseFloat(e.target.value))
                    g.setCellKm(km)
                    liveRegen(km)
                  }}
                />
                <span className={styles.sliderEnd}>{fmtSize(sliderToKm(maxPos))}</span>
              </div>
            </div>
            <div className={styles.colorCol}>
              <ColorFlyout />
            </div>
          </div>
        </div>
      </div>

      <button
        className={`${styles.railBtn} ${g.paintMode === 'brush' ? styles.active : ''}`}
        type="button"
        disabled={!hasGrid}
        data-tip={g.paintMode === 'brush' ? 'Painting — click to stop' : 'Brush over cells'}
        data-tip-key="B"
        aria-label={`Brush over cells${HAS_MOUSE ? ` — or hold ${PAINT_KEY} and drag` : ''}`}
        onClick={() => {
          setPop(null)
          g.setPaintMode(g.paintMode === 'brush' ? null : 'brush')
        }}
      >
        {BrushIcon}
      </button>

      <button
        className={`${styles.railBtn} ${g.paintMode === 'erase' ? styles.active : ''}`}
        type="button"
        disabled={!hasGrid}
        data-tip={g.paintMode === 'erase' ? 'Erasing — click to stop' : 'Erase cells'}
        data-tip-key="X"
        aria-label="Erase cells"
        onClick={() => {
          setPop(null)
          g.setPaintMode(g.paintMode === 'erase' ? null : 'erase')
        }}
      >
        {EraserIcon}
      </button>

      <div className={styles.railItem}>
        <button
          className={`${styles.railBtn} ${styles.clearBtn} ${pop === 'clear' ? styles.active : ''}`}
          type="button"
          disabled={!hasGrid && !g.areaBounds && !g.pins.length}
          data-tip="Clear grid"
          aria-label="Clear grid"
          aria-haspopup="true"
          aria-expanded={pop === 'clear'}
          onClick={() => setPop(pop === 'clear' ? null : 'clear')}
        >
          {TrashIcon}
        </button>

        {/* Clearing has no undo, so it asks first — and asks what to clear,
            because losing an afternoon of marks is a different mistake from
            losing the grid they sit on. */}
        <div className={`${styles.railPop} ${pop === 'clear' ? styles.open : ''}`}>
          <div className={styles.railPopLabel}>Clear what?</div>
          <button
            className={`${styles.menuItem} ${styles.dangerItem}`}
            type="button"
            disabled={!marked}
            onClick={() => {
              setPop(null)
              g.actions.current?.clearMarks()
            }}
          >
            {EraserSmall}
            Marks only
            <span className={styles.confirmCount}>{marked}</span>
          </button>
          <button
            className={`${styles.menuItem} ${styles.dangerItem}`}
            type="button"
            disabled={!g.pins.length}
            onClick={() => {
              setPop(null)
              g.actions.current?.clearPins()
            }}
          >
            {PinSmall}
            All pins
            <span className={styles.confirmCount}>{g.pins.length}</span>
          </button>
          <button
            className={`${styles.menuItem} ${styles.dangerItem}`}
            type="button"
            disabled={!hasGrid && !g.areaBounds}
            onClick={() => {
              setPop(null)
              g.actions.current?.clearAll()
            }}
          >
            {TrashSmall}
            The whole grid
          </button>
          <div className={styles.menuSep} />
          <button className={styles.menuItem} type="button" onClick={() => setPop(null)}>
            Cancel
          </button>
        </div>
      </div>

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
