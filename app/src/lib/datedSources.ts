import L, { type LatLng, type TileLayer } from 'leaflet'

/**
 * Three sources need "pick a date, show that tile set", so they share one shape.
 * Each lists its entries and says how to build a layer for one; the control
 * above them is source-agnostic.
 */
export interface DatedEntry {
  label: string
  meta: string
  make: () => TileLayer | Promise<TileLayer>
}

export interface DatedSource {
  /** Only Sentinel is location-specific — a scene covers ~110 km. */
  perLocation: boolean
  empty: string
  load: (center: LatLng, signal: AbortSignal) => Promise<DatedEntry[]>
}

// Planetary Computer rather than a single-scene tiler: one Sentinel scene only
// covers ~110 km, so anything past its footprint came back 404 and painted the
// map grey. A registered mosaic composites every scene from that day, so the
// whole viewport fills. It also caches warm tiles hard (~0.1s vs ~0.5s cold).
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
const MOSAIC_REG = 'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/register'
const MOSAIC_TILE =
  'https://planetarycomputer.microsoft.com/api/data/v1/mosaic/tiles/{id}/WebMercatorQuad/{z}/{x}/{y}@1x.png?collection=sentinel-2-l2a&assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0&format=png'
const GIBS =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg'
const WAYBACK_WMTS =
  'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/WMTSCapabilities.xml'
const WAYBACK_CFG =
  'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'
const WAYBACK_TILE =
  'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{rel}/{z}/{y}/{x}'

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** One registered mosaic per day, cached — re-picking a date costs nothing. */
const mosaicCache: Record<string, string> = {}

async function sentinelMosaic(day: string): Promise<TileLayer> {
  const layer = (id: string) =>
    L.tileLayer(MOSAIC_TILE.replace('{id}', id), {
      // Sentinel-2 is 10 m/px, which is z14. Asking the tiler for anything
      // deeper just makes it upsample server-side; let Leaflet do it locally.
      // Planetary Computer's natural-colour render starts at z9. Below that,
      // leave this layer out and let the reference imagery underneath carry
      // the overview instead of stretching sparse Sentinel coverage into grey.
      minZoom: 9,
      maxZoom: 19,
      maxNativeZoom: 14,
      attribution: `Sentinel-2 L2A ${day} — Copernicus, via Microsoft Planetary Computer`,
    })

  if (mosaicCache[day]) return layer(mosaicCache[day])
  const res = await fetch(MOSAIC_REG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      datetime: `${day}T00:00:00Z/${day}T23:59:59Z`,
    }),
  })
  const j = await res.json()
  if (!j?.id) throw new Error('no mosaic id')
  mosaicCache[day] = j.id
  return layer(j.id)
}

let waybackCache: { date: string; rel: string }[] | null = null

async function waybackReleases() {
  if (waybackCache) return waybackCache

  // Primary source is the capabilities document on the same host as the tiles:
  // if the tiles are reachable, so is the release list. The S3 config carries
  // the same data but is a second host that some networks block.
  const fromCapabilities = async () => {
    const xml = await (await fetch(WAYBACK_WMTS)).text()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const out: { date: string; rel: string }[] = []
    Array.from(doc.getElementsByTagName('Layer')).forEach((node) => {
      const title = node.getElementsByTagName('ows:Title')[0]
      const res = node.getElementsByTagName('ResourceURL')[0]
      if (!title || !res) return
      const d = /(\d{4}-\d{2}-\d{2})/.exec(title.textContent ?? '')
      const rel = /\/tile\/(\d+)\//.exec(res.getAttribute('template') ?? '')
      if (d && rel) out.push({ date: d[1], rel: rel[1] })
    })
    if (!out.length) throw new Error('no releases')
    return out
  }
  const fromS3 = async () => {
    const cfg = await (await fetch(WAYBACK_CFG)).json()
    const out: { date: string; rel: string }[] = []
    Object.keys(cfg).forEach((rel) => {
      const m = /(\d{4}-\d{2}-\d{2})/.exec(cfg[rel].itemTitle ?? '')
      if (m) out.push({ date: m[1], rel })
    })
    if (!out.length) throw new Error('no releases')
    return out
  }

  const list = await fromCapabilities().catch(fromS3)
  list.sort((a, b) => b.date.localeCompare(a.date))
  waybackCache = list
  return list
}

export const DATED: Record<string, DatedSource> = {
  sentinelDated: {
    perLocation: true,
    empty: 'No passes here in the last 120 days.',
    async load(center, signal) {
      const to = new Date()
      const from = new Date(to.getTime() - 120 * 864e5)
      const res = await fetch(STAC, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: ['sentinel-2-l2a'],
          intersects: { type: 'Point', coordinates: [center.lng, center.lat] },
          datetime: `${from.toISOString()}/${to.toISOString()}`,
          limit: 100,
          sortby: [{ field: 'properties.datetime', direction: 'desc' }],
        }),
      })
      const d = await res.json()
      const byDate: Record<string, number> = {}
      ;(d.features ?? []).forEach((f: any) => {
        const day = f.properties.datetime.slice(0, 10)
        const cloud = Math.round(f.properties['eo:cloud_cover'] ?? 0)
        // cloud % is for the scene over the map centre; the mosaic may pull in
        // neighbours, so treat it as indicative rather than exact
        if (byDate[day] === undefined || cloud < byDate[day]) byDate[day] = cloud
      })
      return Object.keys(byDate)
        .sort()
        .reverse()
        .map((day) => ({
          label: `${day}   ·   ${byDate[day]}% cloud`,
          meta: `${day} · ${byDate[day]}% cloud`,
          make: () => sentinelMosaic(day),
        }))
    },
  },

  // One global pass a day. 250 m/px, so it tops out at z9 and Leaflet upsamples
  // beyond that — fine for smoke, floods and fire scars.
  gibs: {
    perLocation: false,
    empty: 'No imagery available.',
    async load() {
      const today = new Date()
      return Array.from({ length: 120 }, (_, i) => {
        const day = ymd(new Date(today.getTime() - i * 864e5))
        return {
          label: day,
          meta: `${day} · VIIRS true colour`,
          make: () =>
            L.tileLayer(
              GIBS.replace('{layer}', 'VIIRS_SNPP_CorrectedReflectance_TrueColor').replace(
                '{date}',
                day,
              ),
              {
                maxZoom: 19,
                maxNativeZoom: 9,
                attribution: `VIIRS true colour ${day} — NASA EOSDIS GIBS`,
              },
            ),
        }
      })
    },
  },

  // Every dated revision of Esri World Imagery since 2014, same resolution as
  // the live layer — the before/after option.
  wayback: {
    perLocation: false,
    empty: 'Could not load the imagery archive.',
    async load() {
      const list = await waybackReleases()
      return list.map((r) => ({
        label: r.date,
        meta: `${r.date} · Esri World Imagery archive`,
        make: () =>
          L.tileLayer(WAYBACK_TILE.replace('{rel}', r.rel), {
            maxZoom: 19,
            maxNativeZoom: 19,
            attribution: `Esri World Imagery (Wayback ${r.date}) — Esri, Maxar, Earthstar Geographics`,
          }),
      }))
    },
  },
}

export const isDated = (id: string) => Object.prototype.hasOwnProperty.call(DATED, id)
