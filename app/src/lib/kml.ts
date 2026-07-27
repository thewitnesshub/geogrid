import type { LatLngBounds } from 'leaflet'
import type { Cell, Pin } from './types'

/** lng,lat,alt — closed ring (first == last), counter-clockwise. */
function ring(b: LatLngBounds) {
  const w = b.getWest()
  const e = b.getEast()
  const s = b.getSouth()
  const n = b.getNorth()
  return [`${w},${s},0`, `${e},${s},0`, `${e},${n},0`, `${w},${n},0`, `${w},${s},0`].join(' ')
}

/** KML colour is aabbggrr, so the hex is byte-reversed. */
const toBgr = (hex: string) =>
  (hex.replace('#', '').match(/../g) ?? []).reverse().join('')

export function buildKML(cells: Cell[], pins: Pin[], gridColor: string): string {
  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  parts.push('<Document>')
  parts.push('  <name>Search Grid</name>')

  const bgr = toBgr(gridColor)
  // Unfilled cells carry their own colour at zero alpha, mirroring fillOpacity:0
  // in the map style — so switching the fill on in Google Earth gives the grid
  // colour, not black.
  parts.push(
    `  <Style id="todo"><LineStyle><color>ff${bgr}</color><width>1.4</width></LineStyle><PolyStyle><color>00${bgr}</color></PolyStyle></Style>`,
  )
  parts.push(
    `  <Style id="done"><LineStyle><color>ff${bgr}</color><width>2</width></LineStyle><PolyStyle><color>73${bgr}</color></PolyStyle></Style>`,
  )

  const folder = (name: string, style: string, list: Cell[]) => {
    if (!list.length) return
    parts.push(`  <Folder><name>${name} (${list.length})</name>`)
    list.forEach((c) => {
      parts.push(
        `    <Placemark><name>${name}</name><styleUrl>#${style}</styleUrl>` +
          `<Polygon><outerBoundaryIs><LinearRing><tessellate>1</tessellate><coordinates>${ring(c.bounds)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`,
      )
    })
    parts.push('  </Folder>')
  }

  if (pins.length) {
    parts.push(`  <Folder><name>Pins (${pins.length})</name>`)
    pins.forEach((p, i) => {
      parts.push(
        `    <Placemark><name>Pin ${i + 1}</name><Point><coordinates>${p.latlng.lng},${p.latlng.lat},0</coordinates></Point></Placemark>`,
      )
    })
    parts.push('  </Folder>')
  }

  folder('To search', 'todo', cells.filter((c) => !c.searched))
  folder('Searched', 'done', cells.filter((c) => c.searched))

  parts.push('</Document>')
  parts.push('</kml>')
  return parts.join('\n')
}
