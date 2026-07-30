import L, { type TileLayer } from 'leaflet'

const esriAttr = 'Tiles © Esri'

/** Plain tile layers, built lazily so switching does not re-create them. */
export const bases: Record<string, () => TileLayer> = {
  imagery: () =>
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: esriAttr },
    ),
  street: () =>
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: esriAttr },
    ),
  topo: () =>
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: esriAttr },
    ),
  // Standard OSM tiles. Their usage policy is strict about heavy traffic, so
  // this is fine for one investigator and would need a proxy for a busy deploy.
  osm: () =>
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }),
  // HOT style: tracks, water and buildings pushed forward — built for sparsely
  // mapped regions. Note the host is tile-{s}.…, not the usual {s}.tile.….
  hot: () =>
    L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abc',
      attribution: '© OpenStreetMap contributors · tiles by HOT',
    }),
  // Contours + hillshade, for terrain and line-of-sight reasoning.
  topoOsm: () =>
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      subdomains: 'abc',
      attribution: '© OpenStreetMap contributors, SRTM · style © OpenTopoMap (CC-BY-SA)',
    }),
}

export const labelsOverlay = () =>
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, pane: 'overlayPane' },
  )

export interface BasemapOption {
  id: string
  label: string
  /** What the picker button calls it. The menu has a full row to spell a
      source out; the button under the glyph has about eight characters. */
  short: string
}
export interface BasemapGroup {
  group: string
  options: BasemapOption[]
}

/** Drives the picker. "By date" ids are handled by the dated-source machinery. */
export const BASEMAP_GROUPS: BasemapGroup[] = [
  {
    group: 'Esri',
    options: [
      { id: 'imagery', label: 'Imagery', short: 'Imagery' },
      { id: 'hybrid', label: 'Imagery + Labels', short: 'Hybrid' },
      { id: 'street', label: 'Streets', short: 'Streets' },
      { id: 'topo', label: 'Topographic', short: 'Topo' },
    ],
  },
  {
    group: 'By date',
    options: [
      { id: 'sentinelDated', label: 'Sentinel-2 L2A', short: 'Sentinel' },
      { id: 'wayback', label: 'Esri imagery archive', short: 'Archive' },
      { id: 'gibs', label: 'NASA daily (VIIRS)', short: 'VIIRS' },
    ],
  },
  {
    group: 'OpenStreetMap',
    options: [
      { id: 'osm', label: 'Standard', short: 'OSM' },
      { id: 'hot', label: 'Humanitarian', short: 'HOT' },
      { id: 'topoOsm', label: 'OpenTopoMap', short: 'OpenTopo' },
    ],
  },
]

/** id → short name, so the picker button can say what is on screen without
    walking the groups every render. */
export const BASEMAP_SHORT: Record<string, string> = Object.fromEntries(
  BASEMAP_GROUPS.flatMap((g) => g.options.map((o) => [o.id, o.short])),
)

export const DEFAULT_BASE = 'hybrid'

/** The one basemap with its own shortcut — the S key toggles it. */
export const SENTINEL_ID = 'sentinelDated'
