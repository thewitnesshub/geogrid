import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Map as LMap, LatLngBounds } from 'leaflet'
import type { Cell, Pin } from '../lib/types'
import type { RegionFeature } from '../lib/gridMath'
import { DEFAULT_GRID_COLOR } from '../lib/platform'
import { DEFAULT_BASE } from '../lib/basemaps'

/**
 * A stroke tool. The brush takes its direction from the first cell of the
 * stroke, so it both marks and clears; the eraser only ever clears, which is
 * what makes it worth having as its own tool rather than a modifier.
 */
export type PaintMode = 'brush' | 'erase' | null

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
  /** Takes the marks off the cells but leaves the grid and its area standing. */
  clearMarks: () => void
  setDrawMode: (on: boolean) => void
  setPaintMode: (m: PaintMode) => void
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
  /**
   * Which stroke tool is in hand, if any. One value rather than a flag per
   * tool, because picking one has to put the other down.
   */
  paintMode: PaintMode
  setPaintMode: (m: PaintMode) => void
  focus: boolean
  setFocus: (b: boolean) => void

  gridNote: string
  setGridNote: (s: string) => void

  /**
   * Bumped every time a grid is committed, however it was made. The chrome
   * watches this rather than "are there cells now", so drawing a box and
   * filling a region behave alike, and so replacing a grid counts as much as
   * making the first one.
   */
  gridEpoch: number
  noteGridCreated: () => void

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
  const [paintMode, setPaintMode] = useState<PaintMode>(null)
  const [focus, setFocus] = useState(false)
  const [gridNote, setGridNote] = useState('')
  const [gridEpoch, setGridEpoch] = useState(0)

  const mapRef = useRef<LMap | null>(null)
  const actions = useRef<MapActions | null>(null)

  const setGridColor = (c: string) => {
    setGridColorState(c)
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
      paintMode,
      setPaintMode,
      focus,
      setFocus,
      gridNote,
      setGridNote,
      gridEpoch,
      noteGridCreated: () => setGridEpoch((n) => n + 1),
      mapRef,
      actions,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, pins, gridColor, cellKm, areaBounds, regionLabel, base, drawing, paintMode, focus, gridNote, gridEpoch],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGrid() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGrid must be used inside GridProvider')
  return v
}

