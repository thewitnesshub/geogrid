import type { LatLng } from 'leaflet'

/** Only treat a value as coordinates when the whole of it is numbers and separators. */
export function parseCoords(v: string): [number, number] | null {
  if (!/^[-+0-9.,\s]+$/.test(v)) return null
  const nums = v.split(/[,\s]+/).map(parseFloat).filter((n) => !isNaN(n))
  if (nums.length !== 2) return null
  const [lat, lng] = nums
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

export const fmtLatLng = (ll: LatLng | { lat: number; lng: number }) =>
  `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`

export const earthUrl = (ll: LatLng) =>
  `https://earth.google.com/web/@${ll.lat},${ll.lng},0a,1500d,35y,0h,0t,0r`

/**
 * Copernicus Browser — free Sentinel-1/2 imagery, no account needed. Zoom is
 * clamped: Sentinel-2 is 10 m/px, so past ~16 there is nothing more to see.
 */
export function sentinelUrl(ll: LatLng, zoom: number) {
  const z = Math.min(Math.max(zoom, 8), 16)
  return (
    `https://browser.dataspace.copernicus.eu/?zoom=${z}&lat=${ll.lat.toFixed(5)}` +
    `&lng=${ll.lng.toFixed(5)}&themeId=DEFAULT-THEME&datasetId=S2_L2A_CDAS`
  )
}

export const uid = () =>
  `gg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
