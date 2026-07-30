import { useEffect, useRef, useState } from 'react'
import L, { type LatLng, type LatLngBounds, type Rectangle, type TileLayer } from 'leaflet'
import { useGrid, type PaintMode } from '../../state/GridStore'
import { bases, labelsOverlay } from '../../lib/basemaps'
import { DATED, isDated, type DatedEntry } from '../../lib/datedSources'
import { buildCellBounds, type RegionFeature } from '../../lib/gridMath'
import { readStartView, writeView } from '../../lib/storage'
import { fmtLatLng, earthUrl, sentinelUrl, uid } from '../../lib/geo'
import type { Cell, EsriImageryMeta } from '../../lib/types'
import { ContextMenu, type CtxTarget } from './ContextMenu'
import { useToast } from '../../hooks/useToast'

/** Read a design token for the marker SVGs, which are built as markup strings
 *  and so cannot inherit it through the cascade. Only ever called with
 *  theme-invariant tokens, so a marker never needs rebuilding on a theme flip. */
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** The glyph the rail shows for the eraser, so the cursor is the same mark. */
const ERASER_PATH =
  '<path d="M8.5 20.5 3.8 15.8a2 2 0 0 1 0-2.83l8.9-8.9a2 2 0 0 1 2.83 0l4.7 4.7a2 2 0 0 1 0 2.83L12.5 20.5z"/>' +
  '<path d="M8.5 20.5H21"/>'

/**
 * The eraser's glyph, drawn as the cursor.
 *
 * Only the eraser gets one. The brush is the ordinary way to touch a cell and
 * takes the ordinary hand; the eraser takes marks away, and that is worth
 * saying under the pointer.
 *
 * It lands on map imagery, which does not follow the theme, so it is built
 * from the theme-invariant scrim pair: the light on-scrim ink over a heavier
 * dark casing, the same trick that keeps a label legible on a bright tile and
 * a dark one. A cursor cannot read a custom property, so the colours are
 * resolved here rather than left to the cascade — the same reason the markers
 * are built this way. The hotspot sits on the tip, low and left, not in the
 * middle of the glyph.
 */
/** Matched to the pointer hand it swaps places with, so switching tools does
 *  not change how much of the map the cursor covers. */
const CURSOR_PX = 20
/** Match Geonotator: a click this close to the first node closes the vector. */
const VECTOR_CLOSE_PX = 12
/** The tip of the eraser in the 24-unit viewBox, carried to the rendered size
 *  so the hotspot stays on the tip whatever CURSOR_PX becomes. */
const TIP = { x: 4, y: 20.5 }

const toolCursor = (paths: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_PX}" height="${CURSOR_PX}" viewBox="0 0 24 24" ` +
    'fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    `<g stroke="${token('--osw-scrim-strong')}" stroke-width="4.5">${paths}</g>` +
    `<g stroke="${token('--osw-on-scrim')}" stroke-width="1.8">${paths}</g></svg>`
  const hot = (v: number) => Math.round((v / 24) * CURSOR_PX)
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hot(TIP.x)} ${hot(TIP.y)}, crosshair`
}

/** Built on first use — the tokens do not resolve until the styles are in. */
let eraserCursor = ''
const cursorFor = (mode: PaintMode) =>
  mode === 'erase' ? (eraserCursor ||= toolCursor(ERASER_PATH)) : 'pointer'

interface Props {
  /** Hints are shown by the parent; the map reports events that should retire them. */
  onGridCreated: () => void
  onCellMarked: () => void
  onModifierMode: (on: boolean) => void
  onDatedState: (s: { entries: DatedEntry[]; meta: string; index: number } | null) => void
  onEsriMeta: (meta: EsriImageryMeta | null) => void
  datedIndex: number
}

interface GridRuntime {
  id: string
  name: string
  bounds: LatLngBounds
  geo: RegionFeature | null
  cells: Cell[]
  layer: L.LayerGroup
  boundary: L.GeoJSON | null
  visible: boolean
}

export function MapCanvas({
  onGridCreated,
  onCellMarked,
  onModifierMode,
  onDatedState,
  onEsriMeta,
  datedIndex,
}: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const g = useGrid()
  const toast = useToast()
  const [ctx, setCtx] = useState<CtxTarget | null>(null)

  // Everything Leaflet owns lives in refs: React never re-renders these.
  const layers = useRef({
    baseLayer: null as TileLayer | null,
    labels: null as TileLayer | null,
    dated: null as TileLayer | null,
    grid: L.layerGroup(),
    pinLayer: L.layerGroup(),
    pendingBoundary: null as L.GeoJSON | null,
  })
  const cellsRef = useRef<Cell[]>([])
  const gridsRef = useRef<Map<string, GridRuntime>>(new Map())
  const activeGridIdRef = useRef<string | null>(null)
  const hoveredGridRef = useRef<string | null>(null)
  const gridSerial = useRef(0)
  const pinMarkers = useRef<Map<string, L.Marker>>(new Map())
  const region = useRef<RegionFeature | null>(null)
  const paint = useRef({ mode: null as 'mark' | 'erase' | null, stroke: false, dragWasOn: false })
  const drawing = useRef(false)
  const polygonDrawing = useRef(false)
  const polygonSession = useRef<{ cancel: () => void; finish: () => void } | null>(null)
  const paintMode = useRef<PaintMode>(null)
  const cellKmRef = useRef(g.cellKm)
  const gridColorRef = useRef(g.gridColor)
  const datedToken = useRef(0)
  const esriMetaToken = useRef(0)
  const baseRef = useRef(g.base)

  // Mirror reactive values the imperative handlers read.
  useEffect(() => {
    cellKmRef.current = g.cellKm
  }, [g.cellKm])
  useEffect(() => {
    gridColorRef.current = g.gridColor
    cellsRef.current.forEach(paintCell)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.gridColor])
  useEffect(() => {
    baseRef.current = g.base
  }, [g.base])
  useEffect(() => {
    drawing.current = g.drawing
    const map = g.mapRef.current
    if (!map) return
    map.getContainer().classList.toggle('drawingbox', g.drawing)
    if (g.drawing) map.dragging.disable()
    else if (!polygonDrawing.current && !paintMode.current) map.dragging.enable()
  }, [g.drawing, g.mapRef])
  useEffect(() => {
    polygonDrawing.current = g.polygonDrawing
    const map = g.mapRef.current
    if (!map) return
    map.getContainer().classList.toggle('drawingpolygon', g.polygonDrawing)
    if (g.polygonDrawing) map.dragging.disable()
    else {
      polygonSession.current?.cancel()
      if (!drawing.current && !paintMode.current) map.dragging.enable()
    }
  }, [g.polygonDrawing, g.mapRef])
  useEffect(() => {
    paintMode.current = g.paintMode
    const map = g.mapRef.current
    if (!map) return
    const el = map.getContainer()
    el.classList.toggle('painting', !!g.paintMode)
    // Set as a custom property rather than `cursor` directly: it has to reach
    // the cells too, and they carry Leaflet's own pointer cursor.
    el.style.setProperty('--tool-cursor', g.paintMode ? cursorFor(g.paintMode) : '')
    if (g.paintMode) map.dragging.disable()
    else if (!drawing.current && !polygonDrawing.current) map.dragging.enable()
  }, [g.paintMode, g.mapRef])

  const styleFor = (c: Cell): L.PathOptions => {
    const hot = hoveredGridRef.current === c.gridId
    return c.searched
      ? { color: gridColorRef.current, weight: hot ? 3.4 : 2, fillColor: gridColorRef.current, fillOpacity: hot ? 0.58 : 0.45 }
      : { color: gridColorRef.current, weight: hot ? 3 : 1.6, fillColor: gridColorRef.current, fillOpacity: hot ? 0.12 : 0 }
  }

  const paintCell = (c: Cell) => c.rect.setStyle(styleFor(c))

  const commitCells = () => {
    cellsRef.current = [...gridsRef.current.values()].flatMap((grid) => grid.cells)
    g.setCells([...cellsRef.current])
  }

  const commitGridLayers = () => {
    g.setGridLayers(
      [...gridsRef.current.values()].map((grid) => ({
        id: grid.id,
        name: grid.name,
        bounds: grid.bounds,
        cellCount: grid.cells.length,
        visible: grid.visible,
      })),
    )
  }

  const activateGrid = (id: string) => {
    const grid = gridsRef.current.get(id)
    if (!grid) return
    activeGridIdRef.current = id
    g.setActiveGridId(id)
    region.current = grid.geo
    g.setAreaBounds(grid.bounds)
    g.setRegionLabel(grid.geo ? grid.name : null)
  }

  /**
   * Mark or erase one cell; direction is set by the stroke's first cell.
   *
   * Deliberately does no React work. A mark is one Leaflet restyle and nothing
   * else — no state is bumped, because nothing on screen counts the marks any
   * more and the KML is built when it is asked for. That is what keeps the map
   * draggable the instant a cell is tapped.
   */
  const applyPaint = (c: Cell) => {
    const want = paint.current.mode === 'mark'
    if (c.searched === want) return
    c.searched = want
    paintCell(c)
    onCellMarked()
  }

  const loadEsriMetadata = async () => {
    // Bump before the base check so switching away invalidates an Esri request
    // that may still be in flight.
    const token = ++esriMetaToken.current
    const map = g.mapRef.current
    if (!map || (baseRef.current !== 'imagery' && baseRef.current !== 'hybrid')) {
      onEsriMeta(null)
      return
    }
    const c = map.getCenter()
    const zoom = map.getZoom()
    const q = new URLSearchParams({
      geometry: `${c.lng},${c.lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'SRC_DATE,SRC_DATE2,NICE_NAME,NICE_DESC,MinMapLevel,MaxMapLevel,DrawOrder',
      returnGeometry: 'false',
      f: 'json',
    })
    try {
      const res = await fetch(
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/0/query?${q}`,
      )
      const body = await res.json()
      if (token !== esriMetaToken.current) return
      const matches = (body.features ?? [])
        .map((f: { attributes?: Record<string, unknown> }) => f.attributes ?? {})
        .filter((a: Record<string, unknown>) => {
          const min = Number(a.MinMapLevel ?? 0)
          const max = Number(a.MaxMapLevel ?? 99)
          return zoom >= min && zoom <= max
        })
        .sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            Number(b.DrawOrder ?? 0) - Number(a.DrawOrder ?? 0),
        )
      const a = matches[0]
      if (!a) return onEsriMeta(null)
      const raw = Number(a.SRC_DATE ?? 0)
      const date =
        Number.isFinite(Number(a.SRC_DATE2)) && Number(a.SRC_DATE2) > 0
          ? new Date(Number(a.SRC_DATE2)).toISOString().slice(0, 10)
          : /^\d{8}$/.test(String(raw))
            ? `${String(raw).slice(0, 4)}-${String(raw).slice(4, 6)}-${String(raw).slice(6, 8)}`
            : ''
      if (!date) return onEsriMeta(null)
      onEsriMeta({
        date,
        source: String(a.NICE_DESC || a.NICE_NAME || 'Esri World Imagery'),
      })
    } catch {
      if (token === esriMetaToken.current) onEsriMeta(null)
    }
  }

  // ---------- map lifecycle ----------
  useEffect(() => {
    if (!host.current || g.mapRef.current) return
    const start = readStartView()
    const map = L.map(host.current, {
      center: start.center,
      zoom: start.zoom,
      boxZoom: false,
      doubleClickZoom: false,
    })
    g.mapRef.current = map
    layers.current.grid.addTo(map)
    layers.current.pinLayer.addTo(map)

    let saveTimer: number | undefined
    let metaTimer: number | undefined
    map.on('moveend zoomend', () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        const c = map.getCenter()
        writeView(c.lat, c.lng, map.getZoom())
      }, 400)
      window.clearTimeout(metaTimer)
      metaTimer = window.setTimeout(loadEsriMetadata, 350)
    })
    loadEsriMetadata()

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (polygonDrawing.current) return
      L.DomEvent.preventDefault(e.originalEvent)
      setCtx({ latlng: e.latlng, x: e.containerPoint.x, y: e.containerPoint.y })
    })
    map.on('click', (e: L.LeafletMouseEvent) => {
      setCtx(null)
      if (!polygonDrawing.current) return
      // Geonotator's proven close interaction: test every canvas click in
      // screen pixels instead of asking a tiny SVG marker to receive the
      // event. This remains the same comfortable target at every map zoom.
      if (polygonPoints.length >= 3) {
        const first = map.latLngToContainerPoint(polygonPoints[0])
        if (e.containerPoint.distanceTo(first) < VECTOR_CLOSE_PX) {
          finishPolygon()
          return
        }
      }
      addPolygonPoint(e.latlng)
    })
    map.on('movestart zoomstart', () => setCtx(null))

    // ---- draw a custom vector boundary ----
    let polygonPoints: LatLng[] = []
    let polygonLine: L.Polyline | null = null
    let polygonPreview: L.Polyline | null = null
    let vertexLayer: L.LayerGroup | null = null

    const clearPolygonDraft = () => {
      if (polygonLine) map.removeLayer(polygonLine)
      if (polygonPreview) map.removeLayer(polygonPreview)
      if (vertexLayer) map.removeLayer(vertexLayer)
      polygonLine = null
      polygonPreview = null
      vertexLayer = null
      polygonPoints = []
    }

    const draftStyle = () => ({
      color: gridColorRef.current,
      weight: 2,
      dashArray: '6,5',
      fill: false,
    })

    const addPolygonPoint = (point: LatLng) => {
      const previous = polygonPoints[polygonPoints.length - 1]
      if (previous && map.distance(previous, point) < 0.25) return
      polygonPoints.push(point)
      if (!vertexLayer) vertexLayer = L.layerGroup().addTo(map)
      const marker = L.circleMarker(point, {
        radius: polygonPoints.length === 1 ? 5 : 3.5,
        color: gridColorRef.current,
        weight: 2,
        fillColor: token('--osw-surface'),
        fillOpacity: 1,
        bubblingMouseEvents: true,
      }).addTo(vertexLayer)
      if (polygonPoints.length === 1) {
        marker.bindTooltip('Click to close shape', { direction: 'top', offset: [0, -5] })
      }
      if (!polygonLine) polygonLine = L.polyline(polygonPoints, draftStyle()).addTo(map)
      else polygonLine.setLatLngs(polygonPoints)
    }

    const finishPolygon = () => {
      if (!polygonDrawing.current || polygonPoints.length < 3) return
      const ring = polygonPoints.map((p) => [p.lng, p.lat])
      ring.push([...ring[0]])
      const feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [ring] },
      } as RegionFeature
      clearPolygonDraft()
      const boundary = L.geoJSON(feature.geometry as never, {
        style: { color: token('--osw-brand'), weight: 2, fill: false, dashArray: '6,5' },
      })
      layers.current.pendingBoundary = boundary
      g.setRegionLabel('Custom area')
      commitArea(boundary.getBounds(), feature)
      g.setPolygonDrawing(false)
    }

    polygonSession.current = {
      cancel: clearPolygonDraft,
      finish: finishPolygon,
    }

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (!polygonDrawing.current || !polygonPoints.length) return
      const points = [polygonPoints[polygonPoints.length - 1], e.latlng]
      if (!polygonPreview) polygonPreview = L.polyline(points, draftStyle()).addTo(map)
      else polygonPreview.setLatLngs(points)
    })
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (!polygonDrawing.current) return
      L.DomEvent.preventDefault(e.originalEvent)
      finishPolygon()
    })
    const finishOnEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && polygonDrawing.current) finishPolygon()
    }
    document.addEventListener('keydown', finishOnEnter)

    // ---- draw a box ----
    let dragStart: LatLng | null = null
    let temp: Rectangle | null = null
    map.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!drawing.current || polygonDrawing.current) return
      dragStart = e.latlng
      temp = L.rectangle(L.latLngBounds(dragStart, dragStart), {
        color: gridColorRef.current,
        weight: 1.5,
        dashArray: '5,4',
        fillOpacity: 0.05,
      }).addTo(map)
    })
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (temp && dragStart) temp.setBounds(L.latLngBounds(dragStart, e.latlng))
    })
    map.on('mouseup', (e: L.LeafletMouseEvent) => {
      if (!temp || !dragStart) return
      map.removeLayer(temp)
      temp = null
      const b = L.latLngBounds(dragStart, e.latlng)
      dragStart = null
      if (Math.abs(b.getEast() - b.getWest()) < 1e-6) return
      commitArea(b, null)
    })

    return () => {
      document.removeEventListener('keydown', finishOnEnter)
      window.clearTimeout(metaTimer)
      clearPolygonDraft()
      polygonSession.current = null
      map.remove()
      g.mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Adopt a new search area — from a drawn box or a loaded region — and fill it. */
  const commitArea = (b: LatLngBounds, geo: RegionFeature | null) => {
    const map = g.mapRef.current
    if (!map) return
    region.current = geo
    g.setAreaBounds(b)
    g.setDrawing(false)
    g.setPolygonDrawing(false)
    const id = uid()
    const name = `Grid ${++gridSerial.current}`
    const layer = L.layerGroup()
    layer.addTo(layers.current.grid)
    const boundary = geo ? layers.current.pendingBoundary : null
    layers.current.pendingBoundary = null
    if (boundary) boundary.addTo(layer)
    gridsRef.current.set(id, {
      id,
      name,
      bounds: b,
      geo,
      cells: [],
      layer,
      boundary,
      visible: true,
    })
    activateGrid(id)
    generate(b, geo, id)
    onGridCreated()
    // Both routes into a grid end here — the drawn box and the filled region —
    // which is what makes them behave the same for the chrome downstream.
    g.noteGridCreated()
  }

  const generate = (b: LatLngBounds | null, geo: RegionFeature | null, targetId = activeGridIdRef.current) => {
    const map = g.mapRef.current
    const grid = targetId ? gridsRef.current.get(targetId) : null
    if (!map || !b || !grid) return
    const { cells: boundsList, cellKm } = buildCellBounds(b, cellKmRef.current, geo)
    if (cellKm !== cellKmRef.current) {
      cellKmRef.current = cellKm
      g.setCellKm(cellKm)
    }
    // keep marks across a regeneration by south-west corner
    const wasSearched = new Set(
      grid.cells.filter((c) => c.searched).map((c) => c.bounds.getSouthWest().toString()),
    )
    grid.layer.clearLayers()
    if (grid.boundary) grid.boundary.addTo(grid.layer)
    const next: Cell[] = boundsList.map((cb) => {
      const cell: Cell = {
        rect: L.rectangle(cb),
        searched: wasSearched.has(cb.getSouthWest().toString()),
        bounds: cb,
        gridId: grid.id,
      }
      cell.rect.setStyle(styleFor(cell))
      cell.rect.addTo(grid.layer)

      cell.rect.on('click', () => {
        if (paint.current.stroke || drawing.current || polygonDrawing.current) return
        cell.searched = !cell.searched
        paintCell(cell)
        onCellMarked()
      })
      // Cmd/Ctrl-drag paints without leaving the current tool.
      cell.rect.on('mousedown', (e: L.LeafletMouseEvent) => {
        const oe = e.originalEvent
        if (!oe || !(oe.metaKey || oe.ctrlKey) || oe.button !== 0) return
        L.DomEvent.stop(oe)
        paint.current.mode = cell.searched ? 'erase' : 'mark'
        paint.current.stroke = true
        applyPaint(cell)
      })
      cell.rect.on('mouseover', (e: L.LeafletMouseEvent) => {
        const oe = e.originalEvent
        if (!oe || !(oe.metaKey || oe.ctrlKey) || !(oe.buttons & 1)) return
        if (paint.current.mode === null) paint.current.mode = cell.searched ? 'erase' : 'mark'
        paint.current.stroke = true
        applyPaint(cell)
      })
      cell.rect.on('contextmenu', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e)
        setCtx({ latlng: e.latlng, x: e.containerPoint.x, y: e.containerPoint.y })
      })
      return cell
    })
    grid.cells = next
    grid.bounds = b
    grid.geo = geo
    commitCells()
    commitGridLayers()
    g.setGridNote('')
  }

  // ---------- brush strokes from the rail toggle (no modifier, works on touch) ----------
  useEffect(() => {
    const map = g.mapRef.current
    if (!map) return
    const el = map.getContainer()
    const cellAt = (ll: LatLng) =>
      cellsRef.current.find((c) => gridsRef.current.get(c.gridId)?.visible && c.bounds.contains(ll)) ?? null
    let painting = false

    const down = (e: PointerEvent) => {
      if (!paintMode.current || !cellsRef.current.length || e.isPrimary === false) return
      const c = cellAt(map.mouseEventToLatLng(e))
      if (!c) return
      painting = true
      // The eraser only ever clears. The brush takes its direction from the
      // cell it started on, so one tool both marks and un-marks.
      paint.current.mode =
        paintMode.current === 'erase' ? 'erase' : c.searched ? 'erase' : 'mark'
      paint.current.stroke = true
      applyPaint(c)
    }
    const move = (e: PointerEvent) => {
      if (!painting) return
      const c = cellAt(map.mouseEventToLatLng(e))
      if (c) applyPaint(c)
    }
    const up = () => {
      painting = false
      paint.current.mode = null
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.mapRef.current])

  // ---------- the modifier key ----------
  useEffect(() => {
    const map = g.mapRef.current
    if (!map) return
    const begin = () => {
      // Holding the modifier is brushing, so it takes the same hand.
      map.getContainer().classList.add('painting')
      map.getContainer().style.setProperty('--tool-cursor', cursorFor('brush'))
      if (map.dragging.enabled()) {
        map.dragging.disable()
        paint.current.dragWasOn = true
      }
      if (cellsRef.current.length && !drawing.current && !polygonDrawing.current && !paintMode.current) onModifierMode(true)
    }
    const end = () => {
      paint.current.mode = null
      onModifierMode(false)
      if (paintMode.current) return
      map.getContainer().classList.remove('painting')
      map.getContainer().style.setProperty('--tool-cursor', '')
      if (paint.current.dragWasOn) {
        map.dragging.enable()
        paint.current.dragWasOn = false
      }
    }
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') begin()
    }
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') end()
    }
    // capture: must reset before the cell's own handlers run
    const pd = () => {
      paint.current.stroke = false
    }
    document.addEventListener('keydown', kd)
    document.addEventListener('keyup', ku)
    document.addEventListener('pointerdown', pd, true)
    document.addEventListener('mouseup', () => (paint.current.mode = null))
    window.addEventListener('blur', end)
    return () => {
      document.removeEventListener('keydown', kd)
      document.removeEventListener('keyup', ku)
      document.removeEventListener('pointerdown', pd, true)
      window.removeEventListener('blur', end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.mapRef.current])

  // ---------- basemaps ----------
  useEffect(() => {
    const map = g.mapRef.current
    if (!map) return
    const L_ = layers.current
    if (L_.baseLayer) map.removeLayer(L_.baseLayer)
    if (L_.labels) map.removeLayer(L_.labels)
    if (L_.dated) map.removeLayer(L_.dated)
    L_.baseLayer = null
    L_.labels = null
    L_.dated = null

    if (isDated(g.base)) {
      loadEsriMetadata()
      // A same-day Sentinel mosaic still has gaps at scene edges, and the
      // service intentionally stops rendering useful overviews below z9.
      // Keep ordinary imagery underneath so transparent no-data pixels and
      // zoomed-out views remain geographic rather than black or map-grey.
      if (g.base === 'sentinelDated') L_.baseLayer = bases.imagery().addTo(map)
      loadDated(g.base)
      return
    }
    onDatedState(null)
    const id = g.base === 'hybrid' ? 'imagery' : g.base
    L_.baseLayer = bases[id]().addTo(map)
    if (g.base === 'hybrid') L_.labels = labelsOverlay().addTo(map)
    loadEsriMetadata()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.base])

  const datedEntries = useRef<DatedEntry[]>([])

  const loadDated = async (id: string) => {
    const map = g.mapRef.current
    if (!map) return
    const src = DATED[id]
    onDatedState({ entries: [], meta: 'Loading…', index: 0 })
    const ctrl = new AbortController()
    try {
      const entries = await src.load(map.getCenter(), ctrl.signal)
      datedEntries.current = entries
      if (!entries.length) {
        onDatedState({ entries: [], meta: src.empty, index: 0 })
        return
      }
      onDatedState({ entries, meta: entries[0].meta, index: 0 })
      applyDated(0, entries)
    } catch {
      onDatedState({ entries: [], meta: src.empty, index: 0 })
    }
  }

  /** make() may need a round trip, so a later pick must win over an earlier one. */
  const applyDated = async (i: number, entries = datedEntries.current) => {
    const map = g.mapRef.current
    const e = entries[i]
    if (!map || !e) return
    const token = ++datedToken.current
    onDatedState({ entries, meta: `${e.meta} · loading…`, index: i })
    try {
      const layer = await e.make()
      if (token !== datedToken.current) return
      if (layers.current.dated) map.removeLayer(layers.current.dated)
      layers.current.dated = layer
      layer.addTo(map)
      onDatedState({ entries, meta: `${e.meta} · ${entries.length} available`, index: i })
    } catch {
      if (token === datedToken.current)
        onDatedState({ entries, meta: `Could not load imagery for ${e.meta.split(' ')[0]}.`, index: i })
    }
  }

  useEffect(() => {
    if (datedEntries.current.length) applyDated(datedIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datedIndex])

  // ---------- imperative handles for the chrome ----------
  useEffect(() => {
    g.actions.current = {
      generate: (km) => {
        if (km !== undefined) cellKmRef.current = km
        const grid = activeGridIdRef.current ? gridsRef.current.get(activeGridIdRef.current) : null
        if (grid) generate(grid.bounds, grid.geo, grid.id)
      },
      clearAll: () => {
        layers.current.grid.clearLayers()
        gridsRef.current.clear()
        cellsRef.current = []
        activeGridIdRef.current = null
        region.current = null
        g.setAreaBounds(null)
        g.setRegionLabel(null)
        g.setActiveGridId(null)
        g.setGridLayers([])
        g.setGridNote('')
        commitCells()
      },
      /**
       * Pins are their own layer and outlive the grid on purpose — a pin is a
       * place you found, not part of the search pattern over it — so taking
       * them off is its own action rather than a side effect of clearing.
       */
      clearPins: () => {
        layers.current.pinLayer.clearLayers()
        pinMarkers.current.clear()
        g.setPins([])
      },
      /** Keeps the grid and the area, and only takes the marks off it. */
      clearMarks: () => {
        cellsRef.current.forEach((c) => {
          c.searched = false
          paintCell(c)
        })
        commitCells()
      },
      setDrawMode: (on) => g.setDrawing(on),
      setPaintMode: (m) => g.setPaintMode(m),
      flyTo: (lat, lng, zoom) => g.mapRef.current?.setView([lat, lng], zoom ?? g.mapRef.current.getZoom()),
      fitBounds: (b) => g.mapRef.current?.fitBounds(b),
      setRegion: (geo, label) => {
        const map = g.mapRef.current
        if (!map) return
        const feature = { type: 'Feature', properties: {}, geometry: geo } as RegionFeature
        // The accent, not the grid colour. The outline is not part of the grid
        // — it is the boundary the grid was cut from — so it should not move
        // when the grid's colour does, and holding it apart is what lets you
        // read cell against border. Brand is one value in both themes, so
        // reading it once here is safe.
        const gj = L.geoJSON(geo as never, {
          style: { color: token('--osw-brand'), weight: 2, fill: false, dashArray: '6,5' },
        })
        layers.current.pendingBoundary = gj
        g.setRegionLabel(label)
        map.fitBounds(gj.getBounds())
        commitArea(gj.getBounds(), feature)
      },
      setActiveGrid: activateGrid,
      setGridVisible: (id, visible) => {
        const grid = gridsRef.current.get(id)
        if (!grid || grid.visible === visible) return
        grid.visible = visible
        if (visible) grid.layer.addTo(layers.current.grid)
        else layers.current.grid.removeLayer(grid.layer)
        commitGridLayers()
      },
      deleteGrids: (ids) => {
        const doomed = new Set(ids)
        doomed.forEach((id) => {
          const grid = gridsRef.current.get(id)
          if (grid) layers.current.grid.removeLayer(grid.layer)
          gridsRef.current.delete(id)
        })
        if (activeGridIdRef.current && doomed.has(activeGridIdRef.current)) {
          const next = [...gridsRef.current.values()].at(-1) ?? null
          if (next) activateGrid(next.id)
          else {
            activeGridIdRef.current = null
            region.current = null
            g.setActiveGridId(null)
            g.setAreaBounds(null)
            g.setRegionLabel(null)
          }
        }
        commitCells()
        commitGridLayers()
      },
      hoverGrid: (id) => {
        const before = hoveredGridRef.current
        hoveredGridRef.current = id
        if (before) gridsRef.current.get(before)?.cells.forEach(paintCell)
        if (id) gridsRef.current.get(id)?.cells.forEach(paintCell)
        gridsRef.current.forEach((grid) => {
          if (!grid.boundary) return
          grid.boundary.setStyle({
            color: token('--osw-brand'),
            weight: id === grid.id ? 4 : 2,
            fill: false,
            dashArray: '6,5',
          })
        })
      },
      focusGrid: (id) => {
        const grid = gridsRef.current.get(id)
        if (!grid) return
        activateGrid(id)
        if (!grid.visible) {
          grid.visible = true
          grid.layer.addTo(layers.current.grid)
          commitGridLayers()
        }
        g.mapRef.current?.fitBounds(grid.bounds, { padding: [40, 40] })
      },
      setPinVisible: (id, visible) => {
        const marker = pinMarkers.current.get(id)
        if (!marker) return
        if (visible) marker.addTo(layers.current.pinLayer)
        else layers.current.pinLayer.removeLayer(marker)
        g.setPins((pins) => pins.map((pin) => (pin.id === id ? { ...pin, visible } : pin)))
      },
      deletePins: (ids) => {
        const doomed = new Set(ids)
        doomed.forEach((id) => {
          const marker = pinMarkers.current.get(id)
          if (marker) layers.current.pinLayer.removeLayer(marker)
          pinMarkers.current.delete(id)
        })
        g.setPins((pins) => pins.filter((pin) => !doomed.has(pin.id)))
      },
      focusPin: (id) => {
        const pin = g.pins.find((item) => item.id === id)
        if (pin) g.mapRef.current?.setView(pin.latlng, Math.max(g.mapRef.current.getZoom(), 16))
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // ---------- pins ----------
  const addPin = (ll: LatLng) => {
    const map = g.mapRef.current
    if (!map) return
    const id = uid()
    // A dropped pin is evidence, so it takes an identity colour; the dark
    // outline is legibility over imagery, so it takes the scrim. Both are
    // theme-invariant, which is why reading them once here is safe.
    const ink = token('--osw-id-red')
    const outline = token('--osw-scrim-strong')
    const marker = L.marker(ll, {
      icon: L.divIcon({
        className: '',
        iconSize: [24, 32],
        iconAnchor: [12, 31],
        html: `<svg width="24" height="32" viewBox="0 0 24 32"><path d="M12 1C6.5 1 2 5.5 2 11c0 7.5 10 20 10 20s10-12.5 10-20c0-5.5-4.5-10-10-10Z" fill="${ink}" stroke="${outline}" stroke-width="2"/><circle cx="12" cy="11" r="3.6" fill="${outline}"/></svg>`,
      }),
    }).addTo(layers.current.pinLayer)
    marker.bindPopup(
      `<div class="pin-pop"><div class="c">${fmtLatLng(ll)}</div>` +
        `<div class="r"><a href="${earthUrl(ll)}" target="_blank" rel="noopener">Google Earth</a>` +
        `<a href="${sentinelUrl(ll, map.getZoom())}" target="_blank" rel="noopener">Sentinel</a></div></div>`,
    )
    pinMarkers.current.set(id, marker)
    g.setPins((p) => [...p, { id, latlng: ll, visible: true }])
  }

  return (
    <>
      <div ref={host} className="mapCanvas" />
      {ctx && (
        <ContextMenu
          target={ctx}
          onClose={() => setCtx(null)}
          onPin={() => addPin(ctx.latlng)}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(fmtLatLng(ctx.latlng))
              toast('Coordinates copied')
            } catch {
              toast('Copy failed')
            }
          }}
          zoom={g.mapRef.current?.getZoom() ?? 14}
        />
      )}
    </>
  )
}
