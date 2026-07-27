import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Map as LMap, LatLngBounds } from 'leaflet'
import type { Cell, Pin } from '../lib/types'
import type { RegionFeature } from '../lib/gridMath'
import { DEFAULT_GRID_COLOR } from '../lib/platform'
import { DEFAULT_BASE } from '../lib/basemaps'

/**
 * Everything the chrome needs to read or change about the grid. The Leaflet
 * layers themselves are owned by MapCanvas — this holds the state around them,
 * plus imperative handles the map installs so buttons can drive it.
 */
export interface MapActions {
  /**
   * Pass the cell size when regenerating because it just changed. The map
   * mirrors `cellKm` into a ref through an effect, so a caller that sets the
   * state and regenerates in the same tick would otherwise draw the previous
   * size — and at the end of a slider drag nothing follows to correct it.
   */
  generate: (cellKm?: number) => void
  clearAll: () => void
  setDrawMode: (on: boolean) => void
  setPaintArmed: (on: boolean) => void
  flyTo: (lat: number, lng: number, zoom?: number) => void
  fitBounds: (b: [[number, number], [number, number]]) => void
  setRegion: (geo: RegionFeature['geometry'], label: string) => void
}

interface GridState {
  cells: Cell[]
  setCells: (c: Cell[]) => void
  pins: Pin[]
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>

  gridColor: string
  setGridColor: (c: string) => void
  cellKm: number
  setCellKm: (n: number) => void

  areaBounds: LatLngBounds | null
  setAreaBounds: (b: LatLngBounds | null) => void
  regionLabel: string | null
  setRegionLabel: (s: string | null) => void

  base: string
  setBase: (id: string) => void

  drawing: boolean
  setDrawing: (b: boolean) => void
  paintArmed: boolean
  setPaintArmed: (b: boolean) => void
  focus: boolean
  setFocus: (b: boolean) => void

  gridNote: string
  setGridNote: (s: string) => void

  /** Bumped whenever cell marks change, so consumers re-read derived counts. */
  revision: number
  bumpRevision: () => void

  mapRef: React.MutableRefObject<LMap | null>
  actions: React.MutableRefObject<MapActions | null>
}

const Ctx = createContext<GridState | null>(null)

export function GridProvider({ children }: { children: ReactNode }) {
  const [cells, setCells] = useState<Cell[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [gridColor, setGridColorState] = useState(DEFAULT_GRID_COLOR)
  const [cellKm, setCellKm] = useState(1)
  const [areaBounds, setAreaBounds] = useState<LatLngBounds | null>(null)
  const [regionLabel, setRegionLabel] = useState<string | null>(null)
  const [base, setBase] = useState(DEFAULT_BASE)
  const [drawing, setDrawing] = useState(false)
  const [paintArmed, setPaintArmed] = useState(false)
  const [focus, setFocus] = useState(false)
  const [gridNote, setGridNote] = useState('')
  const [revision, setRevision] = useState(0)

  const mapRef = useRef<LMap | null>(null)
  const actions = useRef<MapActions | null>(null)

  /** The Searched stat tracks the grid colour, so the token moves with it. */
  const setGridColor = (c: string) => {
    setGridColorState(c)
    document.documentElement.style.setProperty('--accent2', c)
  }

  const value = useMemo<GridState>(
    () => ({
      cells,
      setCells,
      pins,
      setPins,
      gridColor,
      setGridColor,
      cellKm,
      setCellKm,
      areaBounds,
      setAreaBounds,
      regionLabel,
      setRegionLabel,
      base,
      setBase,
      drawing,
      setDrawing,
      paintArmed,
      setPaintArmed,
      focus,
      setFocus,
      gridNote,
      setGridNote,
      revision,
      bumpRevision: () => setRevision((r) => r + 1),
      mapRef,
      actions,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, pins, gridColor, cellKm, areaBounds, regionLabel, base, drawing, paintArmed, focus, gridNote, revision],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGrid() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGrid must be used inside GridProvider')
  return v
}

/** Counts derived from the cells, recomputed when marks change. */
export function useStats() {
  const { cells, revision } = useGrid()
  return useMemo(() => {
    const total = cells.length
    const done = cells.filter((c) => c.searched).length
    return { total, done, left: total - done }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, revision])
}
