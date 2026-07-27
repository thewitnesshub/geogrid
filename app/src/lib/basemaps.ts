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
      { id: 'imagery', label: 'Imagery' },
      { id: 'hybrid', label: 'Imagery + Labels' },
      { id: 'street', label: 'Streets' },
      { id: 'topo', label: 'Topographic' },
    ],
  },
  {
    group: 'By date',
    options: [
      { id: 'sentinelDated', label: 'Sentinel-2 L2A' },
      { id: 'wayback', label: 'Esri imagery archive' },
      { id: 'gibs', label: 'NASA daily (VIIRS)' },
    ],
  },
  {
    group: 'OpenStreetMap',
    options: [
      { id: 'osm', label: 'Standard' },
      { id: 'hot', label: 'Humanitarian' },
      { id: 'topoOsm', label: 'OpenTopoMap' },
    ],
  },
]

export const DEFAULT_BASE = 'hybrid'
