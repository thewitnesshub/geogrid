import { useEffect, useRef, useState } from 'react'
import L, { type LatLng, type LatLngBounds, type Rectangle, type TileLayer } from 'leaflet'
import { useGrid, type PaintMode } from '../../state/GridStore'
import { bases, labelsOverlay } from '../../lib/basemaps'
import { DATED, isDated, type DatedEntry } from '../../lib/datedSources'
import { buildCellBounds, type RegionFeature } from '../../lib/gridMath'
import { readStartView, writeView } from '../../lib/storage'
import { fmtLatLng, earthUrl, sentinelUrl, uid } from '../../lib/geo'
import type { Cell } from '../../lib/types'
import { ContextMenu, type CtxTarget } from './ContextMenu'
import { useToast } from '../../hooks/useToast'

/** Read a design token for the marker SVGs, which are built as markup strings
 *  and so cannot inherit it through the cascade. Only ever called with
 *  theme-invariant tokens, so a marker never needs rebuilding on a theme flip. */
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

interface Props {
  /** Hints are shown by the parent; the map reports events that should retire them. */
  onGridCreated: () => void
  onCellMarked: () => void
  onModifierMode: (on: boolean) => void
  onDatedState: (s: { entries: DatedEntry[]; meta: string; index: number } | null) => void
  datedIndex: number
}

export function MapCanvas({
  onGridCreated,
  onCellMarked,
  onModifierMode,
  onDatedState,
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
    areaRect: null as Rectangle | null,
    regionLayer: null as L.GeoJSON | null,
  })
  const cellsRef = useRef<Cell[]>([])
  const region = useRef<RegionFeature | null>(null)
  const paint = useRef({ mode: null as 'mark' | 'erase' | null, stroke: false, dragWasOn: false })
  const drawing = useRef(false)
  const paintMode = useRef<PaintMode>(null)
  const cellKmRef = useRef(g.cellKm)
  const gridColorRef = useRef(g.gridColor)
  const datedToken = useRef(0)

  // Mirror reactive values the imperative handlers read.
  useEffect(() => {
    cellKmRef.current = g.cellKm
  }, [g.cellKm])
  useEffect(() => {
    gridColorRef.current = g.gridColor
    cellsRef.current.forEach(paintCell)
    layers.current.areaRect?.setStyle({ color: g.gridColor })
    layers.current.regionLayer?.setStyle({ color: g.gridColor })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.gridColor])
  useEffect(() => {
    drawing.current = g.drawing
    const map = g.mapRef.current
    if (!map) return
    map.getContainer().classList.toggle('drawingbox', g.drawing)
    if (g.drawing) map.dragging.disable()
    else if (!paintMode.current) map.dragging.enable()
  }, [g.drawing, g.mapRef])
  useEffect(() => {
    paintMode.current = g.paintMode
    const map = g.mapRef.current
    if (!map) return
    map.getContainer().classList.toggle('painting', !!g.paintMode)
    if (g.paintMode) map.dragging.disable()
    else if (!drawing.current) map.dragging.enable()
  }, [g.paintMode, g.mapRef])

  const styleFor = (c: Cell): L.PathOptions =>
    c.searched
      ? { color: gridColorRef.current, weight: 2, fillColor: gridColorRef.current, fillOpacity: 0.45 }
      : { color: gridColorRef.current, weight: 1.6, fillColor: gridColorRef.current, fillOpacity: 0 }

  const paintCell = (c: Cell) => c.rect.setStyle(styleFor(c))

  const commitCells = () => {
    g.setCells([...cellsRef.current])
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
    map.on('moveend zoomend', () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        const c = map.getCenter()
        writeView(c.lat, c.lng, map.getZoom())
      }, 400)
    })

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent)
      setCtx({ latlng: e.latlng, x: e.containerPoint.x, y: e.containerPoint.y })
    })
    map.on('click', () => setCtx(null))
    map.on('movestart zoomstart', () => setCtx(null))

    // ---- draw a box ----
    let dragStart: LatLng | null = null
    let temp: Rectangle | null = null
    map.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!drawing.current) return
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
      map.remove()
      g.mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Adopt a new search area — from a drawn box or a loaded region — and fill it. */
  const commitArea = (b: LatLngBounds, geo: RegionFeature | null) => {
    const map = g.mapRef.current
    if (!map) return
    if (layers.current.areaRect) map.removeLayer(layers.current.areaRect)
    layers.current.areaRect = null
    if (!geo && layers.current.regionLayer) {
      map.removeLayer(layers.current.regionLayer)
      layers.current.regionLayer = null
      region.current = null
      g.setRegionLabel(null)
    }
    region.current = geo
    if (!geo) {
      layers.current.areaRect = L.rectangle(b, {
        color: gridColorRef.current,
        weight: 2,
        fill: false,
        dashArray: '6,5',
      }).addTo(map)
    }
    g.setAreaBounds(b)
    g.setDrawing(false)
    generate(b, geo)
    onGridCreated()
  }

  const generate = (b: LatLngBounds | null, geo: RegionFeature | null) => {
    const map = g.mapRef.current
    if (!map || !b) return
    const { cells: boundsList, cellKm } = buildCellBounds(b, cellKmRef.current, geo)
    if (cellKm !== cellKmRef.current) {
      cellKmRef.current = cellKm
      g.setCellKm(cellKm)
    }
    // keep marks across a regeneration by south-west corner
    const wasSearched = new Set(
      cellsRef.current.filter((c) => c.searched).map((c) => c.bounds.getSouthWest().toString()),
    )
    layers.current.grid.clearLayers()
    const next: Cell[] = boundsList.map((cb) => {
      const cell: Cell = { rect: L.rectangle(cb), searched: wasSearched.has(cb.getSouthWest().toString()), bounds: cb }
      cell.rect.setStyle(styleFor(cell))
      cell.rect.addTo(layers.current.grid)

      cell.rect.on('click', () => {
        if (paint.current.stroke) return
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
    cellsRef.current = next
    commitCells()
    g.setGridNote('')
  }

  // ---------- brush strokes from the rail toggle (no modifier, works on touch) ----------
  useEffect(() => {
    const map = g.mapRef.current
    if (!map) return
    const el = map.getContainer()
    const cellAt = (ll: LatLng) => cellsRef.current.find((c) => c.bounds.contains(ll)) ?? null
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
      map.getContainer().classList.add('painting')
      if (map.dragging.enabled()) {
        map.dragging.disable()
        paint.current.dragWasOn = true
      }
      if (cellsRef.current.length && !drawing.current && !paintMode.current) onModifierMode(true)
    }
    const end = () => {
      paint.current.mode = null
      onModifierMode(false)
      if (paintMode.current) return
      map.getContainer().classList.remove('painting')
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
      loadDated(g.base)
      return
    }
    onDatedState(null)
    const id = g.base === 'hybrid' ? 'imagery' : g.base
    L_.baseLayer = bases[id]().addTo(map)
    if (g.base === 'hybrid') L_.labels = labelsOverlay().addTo(map)
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
        generate(g.areaBounds, region.current)
      },
      clearAll: () => {
        const map = g.mapRef.current
        layers.current.grid.clearLayers()
        cellsRef.current = []
        if (map && layers.current.areaRect) map.removeLayer(layers.current.areaRect)
        layers.current.areaRect = null
        if (map && layers.current.regionLayer) map.removeLayer(layers.current.regionLayer)
        layers.current.regionLayer = null
        region.current = null
        g.setAreaBounds(null)
        g.setRegionLabel(null)
        g.setGridNote('')
        commitCells()
      },
      setDrawMode: (on) => g.setDrawing(on),
      setPaintMode: (m) => g.setPaintMode(m),
      flyTo: (lat, lng, zoom) => g.mapRef.current?.setView([lat, lng], zoom ?? g.mapRef.current.getZoom()),
      fitBounds: (b) => g.mapRef.current?.fitBounds(b),
      setRegion: (geo, label) => {
        const map = g.mapRef.current
        if (!map) return
        if (layers.current.regionLayer) map.removeLayer(layers.current.regionLayer)
        const feature = { type: 'Feature', properties: {}, geometry: geo } as RegionFeature
        const gj = L.geoJSON(geo as never, {
          style: { color: gridColorRef.current, weight: 2, fill: false, dashArray: '6,5' },
        }).addTo(map)
        layers.current.regionLayer = gj
        g.setRegionLabel(label)
        map.fitBounds(gj.getBounds())
        commitArea(gj.getBounds(), feature)
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
    g.setPins((p) => [...p, { id, latlng: ll }])
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
