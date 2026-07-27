import type { LatLngBounds, LatLng, Rectangle } from 'leaflet'

/** One cell of the search grid. `rect` is its Leaflet layer. */
export interface Cell {
  rect: Rectangle
  searched: boolean
  bounds: LatLngBounds
}

export interface Pin {
  id: string
  latlng: LatLng
}

export type ThemeChoice = 'system' | 'light' | 'dark'
