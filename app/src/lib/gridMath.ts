import L, { type LatLngBounds } from 'leaflet'
import booleanIntersects from '@turf/boolean-intersects'
import { polygon as turfPolygon } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

/** Beyond this the browser chokes, so the cell size is raised to fit instead. */
export const CELL_CAP = 3000

/** Slider position 0→0.1 km, 50→1 km, 100→10 km. */
export const sliderToKm = (pos: number) => 0.1 * Math.pow(100, pos / 100)
export const kmToSlider = (km: number) =>
  Math.max(0, Math.min(100, (100 * Math.log(km / 0.1)) / Math.log(100)))

export const fmtSize = (km: number) =>
  km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`

export interface Dims {
  south: number
  west: number
  north: number
  east: number
  cols: number
  rows: number
}

export function computeDims(bounds: LatLngBounds, cellKm: number): Dims {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const m = Math.max(10, cellKm * 1000)
  const midLat = (sw.lat + ne.lat) / 2
  const latStep = m / 111320
  const lngStep = m / (111320 * Math.cos((midLat * Math.PI) / 180))
  return {
    south: sw.lat,
    west: sw.lng,
    north: ne.lat,
    east: ne.lng,
    cols: Math.max(1, Math.ceil((ne.lng - sw.lng) / lngStep)),
    rows: Math.max(1, Math.ceil((ne.lat - sw.lat) / latStep)),
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
  const widthM = (ne.lng - sw.lng) * 111320 * Math.cos((midLat * Math.PI) / 180)
  const heightM = (ne.lat - sw.lat) * 111320
  let cellKm = Math.sqrt(Math.abs(widthM * heightM) / CELL_CAP) / 1000
  for (let g = 0; g < 50; g++) {
    const d = computeDims(bounds, cellKm)
    if (d.cols * d.rows <= CELL_CAP) break
    cellKm *= 1.03
  }
  return cellKm
}

export type RegionFeature = Feature<Polygon | MultiPolygon>

/**
 * The bounds of every cell in the grid. When a region is loaded, cells that do
 * not touch its real shape are dropped, so the grid follows the boundary rather
 * than its bounding box.
 */
export function buildCellBounds(
  bounds: LatLngBounds,
  cellKm: number,
  region: RegionFeature | null,
): { cells: LatLngBounds[]; cellKm: number } {
  let km = cellKm
  let d = computeDims(bounds, km)
  if (d.cols * d.rows > CELL_CAP) {
    km = clampCellToCap(bounds)
    d = computeDims(bounds, km)
  }

  const cells: LatLngBounds[] = []
  const latStep = (d.north - d.south) / d.rows
  const lngStep = (d.east - d.west) / d.cols

  for (let r = 0; r < d.rows; r++) {
    const cellNorth = d.north - r * latStep
    const cellSouth = d.north - (r + 1) * latStep
    for (let c = 0; c < d.cols; c++) {
      const cellWest = d.west + c * lngStep
      const cellEast = d.west + (c + 1) * lngStep
      if (region) {
        const poly = turfPolygon([
          [
            [cellWest, cellSouth],
            [cellEast, cellSouth],
            [cellEast, cellNorth],
            [cellWest, cellNorth],
            [cellWest, cellSouth],
          ],
        ])
        if (!booleanIntersects(poly, region)) continue
      }
      cells.push(L.latLngBounds([cellSouth, cellWest], [cellNorth, cellEast]))
    }
  }
  return { cells, cellKm: km }
}
