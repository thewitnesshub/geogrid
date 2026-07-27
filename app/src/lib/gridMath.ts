import L, { type LatLngBounds } from 'leaflet'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/** Beyond this the browser chokes, so the cell size is raised to fit instead. */
export const CELL_CAP = 3000

/** Slider position 0→0.1 km, 50→1 km, 100→10 km. */
export const sliderToKm = (pos: number) => 0.1 * Math.pow(100, pos / 100)
export const kmToSlider = (km: number) =>
  Math.max(0, Math.min(100, (100 * Math.log(km / 0.1)) / Math.log(100)))

/**
 * The lowest slider position an area can actually hold. Below it every cell
 * size means more than CELL_CAP cells, so buildCellBounds raises the size back
 * and the thumb springs out from under the cursor — over a region the size of
 * Bavaria that is the left nine tenths of the track. Bounding the track instead
 * spends its whole length on sizes that exist. Rounded up to a step so the
 * positions stay on the same grid as the rest of the range.
 */
export const minSliderPos = (bounds: LatLngBounds) =>
  Math.min(100, Math.ceil(kmToSlider(clampCellToCap(bounds)) * 2) / 2)

/**
 * The largest cell an area can hold and still fit one across. Past it the
 * lattice cannot stay inside the area at all — a single cell wider than the box
 * you drew has nowhere to go but out of it — so the track stops here.
 */
export function maxCellToFit(bounds: LatLngBounds): number {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const midLat = (sw.lat + ne.lat) / 2
  const w = projX(ne.lng) - projX(sw.lng)
  const h = projY(ne.lat) - projY(sw.lat)
  return (Math.min(w, h) * Math.max(0.01, Math.cos((midLat * Math.PI) / 180))) / 1000
}

/** Rounded down to a step, and never below the floor, so the track cannot invert. */
export const maxSliderPos = (bounds: LatLngBounds) =>
  Math.max(
    minSliderPos(bounds),
    Math.min(100, Math.floor(kmToSlider(maxCellToFit(bounds)) * 2) / 2),
  )

export const fmtSize = (km: number) =>
  km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`

// ---------- Web Mercator, the plane the map itself is drawn in ----------

const R = 6378137
const MAX_LAT = 85.051129

const projX = (lng: number) => R * ((lng * Math.PI) / 180)
const projY = (lat: number) => {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180
  return R * Math.log(Math.tan(Math.PI / 4 + phi / 2))
}
const invLng = (x: number) => ((x / R) * 180) / Math.PI
const invLat = (y: number) => ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI

/**
 * The lattice a grid is cut from: one square step in Web Mercator metres,
 * anchored at the area's north-west corner.
 *
 * The cells exist to be looked at and ticked off, so what must never vary is
 * how they *draw*. Cutting the lattice in the map's own projected plane makes
 * every cell the identical square of pixels at every latitude and every zoom,
 * and keeps rows and columns aligned. The price is paid in ground metres: the
 * projection stretches toward the poles, so a northern cell covers less ground
 * than a southern one. `cellKm` is therefore read as the cell's ground size at
 * the area's middle latitude, and drifts away from that toward the edges.
 */
export interface Dims {
  /** West edge, mercator metres. */
  x0: number
  /** North edge, mercator metres. */
  yTop: number
  /** Cell side, mercator metres. */
  step: number
  cols: number
  rows: number
  total: number
}

/**
 * How the lattice handles an area that is not a whole number of cells across.
 *
 * A square cell cannot tile an arbitrary rectangle exactly, so something has
 * to give at the edge. `inside` keeps every cell within the area, which is what
 * a hand-drawn box wants: the box is the promise, and a grid spilling past it
 * says the tool ignored what you drew. `cover` runs past the edge instead,
 * which is right for a region, where the bounds are only the outline's bounding
 * box and the mask drops whatever falls outside the shape anyway.
 */
export type Fit = 'inside' | 'cover'

export function computeDims(bounds: LatLngBounds, cellKm: number, fit: Fit = 'cover'): Dims {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const m = Math.max(10, cellKm * 1000)
  const midLat = (sw.lat + ne.lat) / 2
  // Ground metres shrink relative to mercator metres by cos(lat); size the
  // step so the cell measures cellKm on the ground at the area's middle.
  const step = m / Math.max(0.01, Math.cos((midLat * Math.PI) / 180))
  const west = projX(sw.lng)
  const north = projY(ne.lat)
  const w = projX(ne.lng) - west
  const h = north - projY(sw.lat)
  const fitCount = (span: number) =>
    Math.max(1, fit === 'inside' ? Math.floor(span / step) : Math.ceil(span / step))
  const cols = fitCount(w)
  const rows = fitCount(h)
  // Centre the lattice. Whatever does not divide evenly is then shared between
  // opposite edges rather than all of it hanging off the east and the south.
  return {
    x0: west + (w - cols * step) / 2,
    yTop: north - (h - rows * step) / 2,
    step,
    cols,
    rows,
    total: cols * rows,
  }
}

/**
 * The smallest cell that still keeps the grid under CELL_CAP — i.e. the most
 * detail that fits. Seeded from area/cap, then nudged up until it really fits.
 */
export function clampCellToCap(bounds: LatLngBounds): number {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const midLat = (sw.lat + ne.lat) / 2
  const w = projX(ne.lng) - projX(sw.lng)
  const h = projY(ne.lat) - projY(sw.lat)
  const step = Math.sqrt(Math.abs(w * h) / CELL_CAP)
  let cellKm = (step * Math.max(0.01, Math.cos((midLat * Math.PI) / 180))) / 1000
  for (let g = 0; g < 50; g++) {
    if (computeDims(bounds, cellKm).total <= CELL_CAP) break
    cellKm *= 1.03
  }
  return cellKm
}

export type RegionFeature = Feature<Polygon | MultiPolygon>

/** An edge of the boundary, in fractional cell coordinates. */
interface Edge {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Which cells the region touches, as a flag per cell.
 *
 * Asking "does this cell meet the region?" once per cell reads better but costs
 * a full pass over the boundary every time, and a Nominatim outline runs to six
 * figures of points — times a few thousand cells, that is minutes of frozen
 * page. Walking the boundary once and marking as we go gives the same answer
 * for a fraction of the work.
 *
 * Straight lines are not preserved by the projection, but over the span of one
 * boundary segment the bend is far below cell size, so projecting the segment's
 * endpoints and treating it as straight in cell coordinates is exact for this
 * purpose. Row 0 is the northernmost, matching the loop in buildCellBounds.
 */
function regionMask(region: RegionFeature, d: Dims): Uint8Array {
  const mask = new Uint8Array(d.total)
  const geom = region.geometry
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]

  // Cell coordinates: x eastward from the west edge, y southward from the
  // north edge, so y and the row index run the same way. Holes are simply more
  // rings.
  const toCol = (lng: number) => (projX(lng) - d.x0) / d.step
  const toRow = (lat: number) => (d.yTop - projY(lat)) / d.step

  const edges: Edge[] = []
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0; i + 1 < ring.length; i++) {
        edges.push({
          x0: toCol(ring[i][0]),
          y0: toRow(ring[i][1]),
          x1: toCol(ring[i + 1][0]),
          y1: toRow(ring[i + 1][1]),
        })
      }
    }
  }

  // The boundary itself. Each edge is walked in steps of at most one cell and
  // every cell the step spans is marked — a straight step cannot leave the box
  // its endpoints make, so no crossed cell is missed.
  for (const e of edges) {
    const dx = e.x1 - e.x0
    const dy = e.y1 - e.y0
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
    for (let s = 0; s < steps; s++) {
      const ax = e.x0 + (dx * s) / steps
      const ay = e.y0 + (dy * s) / steps
      const bx = e.x0 + (dx * (s + 1)) / steps
      const by = e.y0 + (dy * (s + 1)) / steps
      const c0 = Math.max(0, Math.floor(Math.min(ax, bx)))
      const c1 = Math.min(d.cols - 1, Math.floor(Math.max(ax, bx)))
      const r0 = Math.max(0, Math.floor(Math.min(ay, by)))
      const r1 = Math.min(d.rows - 1, Math.floor(Math.max(ay, by)))
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) mask[r * d.cols + c] = 1
      }
    }
  }

  // The inside, one scanline per row rather than one test per cell. Where the
  // row's middle crosses the boundary, sorted, the crossings pair up into spans
  // that are inside it — which is the even-odd rule, so holes fall out for free.
  const xs: number[] = []
  for (let r = 0; r < d.rows; r++) {
    const y = r + 0.5
    xs.length = 0
    for (const e of edges) {
      if (e.y0 <= y === e.y1 <= y) continue
      xs.push(e.x0 + ((y - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0))
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5))
      const to = Math.min(d.cols - 1, Math.floor(xs[i + 1] - 0.5))
      for (let c = from; c <= to; c++) mask[r * d.cols + c] = 1
    }
  }

  return mask
}

/**
 * The bounds of every cell in the grid. When a region is loaded, cells that do
 * not touch its real shape are dropped, so the grid follows the boundary rather
 * than its bounding box.
 *
 * The lattice is laid out at full size and allowed to overhang the east and
 * south edges by up to a cell. Shrinking the step to land exactly on the
 * bounds instead would squash every cell — by a hair over a big grid, by an
 * eighth over one eight cells wide.
 */
export function buildCellBounds(
  bounds: LatLngBounds,
  cellKm: number,
  region: RegionFeature | null,
): { cells: LatLngBounds[]; cellKm: number } {
  // A drawn box is a promise to stay inside it. A region's bounds are only its
  // bounding box, and the mask trims the overhang, so there it may run past.
  const fit: Fit = region ? 'cover' : 'inside'
  // Too big to fit even once and staying inside becomes impossible, so the
  // size comes down to the one that does. The slider's own ceiling matches
  // this, so it is a backstop rather than something a drag can hit.
  let km = fit === 'inside' ? Math.min(cellKm, maxCellToFit(bounds)) : cellKm
  let d = computeDims(bounds, km, fit)
  if (d.total > CELL_CAP) {
    km = clampCellToCap(bounds)
    d = computeDims(bounds, km, fit)
  }

  const mask = region ? regionMask(region, d) : null

  // Cell edges, unprojected once per row and column rather than per cell.
  const lats: number[] = []
  for (let r = 0; r <= d.rows; r++) lats.push(invLat(d.yTop - r * d.step))
  const lngs: number[] = []
  for (let c = 0; c <= d.cols; c++) lngs.push(invLng(d.x0 + c * d.step))

  const cells: LatLngBounds[] = []
  for (let r = 0; r < d.rows; r++) {
    for (let c = 0; c < d.cols; c++) {
      if (mask && !mask[r * d.cols + c]) continue
      cells.push(L.latLngBounds([lats[r + 1], lngs[c]], [lats[r], lngs[c + 1]]))
    }
  }
  return { cells, cellKm: km }
}
