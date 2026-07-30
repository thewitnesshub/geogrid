import type { LatLngBounds, LatLng, Rectangle } from 'leaflet'

/** One cell of the search grid. `rect` is its Leaflet layer. */
export interface Cell {
  rect: Rectangle
  searched: boolean
  bounds: LatLngBounds
  gridId: string
}

export interface Pin {
  id: string
  latlng: LatLng
  visible: boolean
}

export interface GridLayerItem {
  id: string
  name: string
  bounds: LatLngBounds
  cellCount: number
  visible: boolean
}

export interface EsriImageryMeta {
  /** Acquisition date in ISO calendar form. */
  date: string
  source: string
}

export type ThemeChoice = 'system' | 'light' | 'dark'
