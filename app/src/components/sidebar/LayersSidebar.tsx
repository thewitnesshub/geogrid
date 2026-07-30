import { useEffect, useMemo, useState } from 'react'
import { useGrid } from '../../state/GridStore'
import styles from './LayersSidebar.module.css'

const GridIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 12h18M12 3v18" />
  </svg>
)
const PinIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
const EyeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOffIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 3 18 18" />
    <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.1 3.2M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.1-.9" />
  </svg>
)

interface Props {
  open: boolean
  /** Raised the moment the drawer is used, so a timed peek stops counting. */
  onHold?: () => void
}

export function LayersSidebar({ open, onHold }: Props) {
  const g = useGrid()
  const [pickedGrids, setPickedGrids] = useState<Set<string>>(new Set())
  const [pickedPins, setPickedPins] = useState<Set<string>>(new Set())
  const pickedCount = pickedGrids.size + pickedPins.size

  useEffect(() => {
    const gridIds = new Set(g.gridLayers.map((grid) => grid.id))
    const pinIds = new Set(g.pins.map((pin) => pin.id))
    setPickedGrids((picked) => new Set([...picked].filter((id) => gridIds.has(id))))
    setPickedPins((picked) => new Set([...picked].filter((id) => pinIds.has(id))))
  }, [g.gridLayers, g.pins])

  const allPicked = useMemo(
    () =>
      g.gridLayers.length + g.pins.length > 0 &&
      pickedGrids.size === g.gridLayers.length &&
      pickedPins.size === g.pins.length,
    [g.gridLayers.length, g.pins.length, pickedGrids.size, pickedPins.size],
  )

  const togglePick = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) =>
    setter((before) => {
      const next = new Set(before)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const deletePicked = () => {
    if (!pickedCount) return
    g.actions.current?.deleteGrids([...pickedGrids])
    g.actions.current?.deletePins([...pickedPins])
    setPickedGrids(new Set())
    setPickedPins(new Set())
  }

  return (
    <aside
      className={`${styles.drawer} ${open ? styles.open : ''}`}
      aria-label="Map layers"
      aria-hidden={!open}
      onMouseEnter={onHold}
      onFocusCapture={onHold}
      onPointerDown={onHold}
    >
      <div className={styles.scroll}>
        <div className={styles.sectionHead}>
          <span className={styles.title}>Grids</span>
          <span className={styles.count}>{g.gridLayers.length}</span>
          <label className={styles.selectAll}>
            <input
              type="checkbox"
              checked={allPicked}
              onChange={(e) => {
                if (e.target.checked) {
                  setPickedGrids(new Set(g.gridLayers.map((grid) => grid.id)))
                  setPickedPins(new Set(g.pins.map((pin) => pin.id)))
                } else {
                  setPickedGrids(new Set())
                  setPickedPins(new Set())
                }
              }}
            />{' '}
            All
          </label>
        </div>
        {g.gridLayers.length ? (
          <ul className={styles.list}>
            {g.gridLayers.map((grid) => (
              <li
                key={grid.id}
                className={[
                  styles.row,
                  g.activeGridId === grid.id ? styles.active : '',
                  !grid.visible ? styles.hidden : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => g.actions.current?.hoverGrid(grid.id)}
                onMouseLeave={() => g.actions.current?.hoverGrid(null)}
                onClick={() => g.actions.current?.setActiveGrid(grid.id)}
                onDoubleClick={() => g.actions.current?.focusGrid(grid.id)}
              >
                <input
                  className={styles.check}
                  type="checkbox"
                  aria-label={`Select ${grid.name}`}
                  checked={pickedGrids.has(grid.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => togglePick(setPickedGrids, grid.id)}
                />
                <span className={styles.glyph}>{GridIcon}</span>
                <span className={styles.copy}>
                  <span className={styles.label}>{grid.name}</span>
                  <span className={styles.meta}>{grid.cellCount} cells</span>
                </span>
                <button
                  className={`${styles.eye} ${!grid.visible ? styles.eyeOff : ''}`}
                  type="button"
                  aria-label={`${grid.visible ? 'Hide' : 'Show'} ${grid.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    g.actions.current?.setGridVisible(grid.id, !grid.visible)
                  }}
                >
                  {grid.visible ? EyeIcon : EyeOffIcon}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Draw a box, vector area, or region to add a grid.</p>
        )}

        <div className={styles.sectionHead}>
          <span className={styles.title}>Placemarks</span>
          <span className={styles.count}>{g.pins.length}</span>
        </div>
        {g.pins.length ? (
          <ul className={styles.list}>
            {g.pins.map((pin, index) => (
              <li
                key={pin.id}
                className={`${styles.row} ${!pin.visible ? styles.hidden : ''}`}
                onDoubleClick={() => g.actions.current?.focusPin(pin.id)}
              >
                <input
                  className={styles.check}
                  type="checkbox"
                  aria-label={`Select Placemark ${index + 1}`}
                  checked={pickedPins.has(pin.id)}
                  onChange={() => togglePick(setPickedPins, pin.id)}
                />
                <span className={styles.glyph}>{PinIcon}</span>
                <span className={styles.copy}>
                  <span className={styles.label}>Placemark {index + 1}</span>
                  <span className={styles.meta}>
                    {pin.latlng.lat.toFixed(5)}, {pin.latlng.lng.toFixed(5)}
                  </span>
                </span>
                <button
                  className={`${styles.eye} ${!pin.visible ? styles.eyeOff : ''}`}
                  type="button"
                  aria-label={`${pin.visible ? 'Hide' : 'Show'} Placemark ${index + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    g.actions.current?.setPinVisible(pin.id, !pin.visible)
                  }}
                >
                  {pin.visible ? EyeIcon : EyeOffIcon}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Right-click the map to add a placemark.</p>
        )}
      </div>
      <div className={styles.foot}>
        <span className={styles.footMeta}>{pickedCount} selected</span>
        <button className={styles.delete} type="button" disabled={!pickedCount} onClick={deletePicked}>
          Delete selected
        </button>
      </div>
    </aside>
  )
}
