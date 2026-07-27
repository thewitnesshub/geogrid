# GeoGrid — search grids over satellite imagery

**Live app: [thewitnesshub.github.io/geogrid](https://thewitnesshub.github.io/geogrid/)**

A tool for systematic visual search: lay a grid over map imagery, work through it
cell by cell, and export the result to KML for Google Earth. Built for OSINT and
geolocation work, where the hard part is not finding a thing but proving you
looked everywhere.

Everything runs in the browser. No server, no account, no API keys.

## Features

- **Define an area** — drag a box on the map, or type a city / district / region
  name and the grid fills that boundary's real shape.
- **Work the grid** — click cells to mark them searched, or brush across many at
  once (hold <kbd>⌘</kbd>/<kbd>Ctrl</kbd> and drag, or use the brush tool).
  Live counts of cells searched and remaining.
- **Basemaps** — Esri World Imagery / Streets / Topographic, and OpenStreetMap
  (Standard, Humanitarian, OpenTopoMap).
- **Imagery by date** — Sentinel-2 L2A scenes (via Microsoft Planetary
  Computer), the Esri World Imagery Wayback archive back to 2014, and NASA's
  daily VIIRS pass — each with a date picker, for before/after comparison.
- **Navigate** — search a place name or jump straight to `lat, lng`.
  Right-click anywhere to drop a pin, copy coordinates, or open the spot in
  Google Earth or Copernicus Browser.
- **Export to KML** — searched and to-search cells in separate folders, plus
  your pins. Opens directly in Google Earth.
- **The small things** — light/dark theme, keyboard shortcuts (<kbd>?</kbd>
  shows the list), focus mode that hides all chrome, and it reopens where you
  left off.

## Running it

```bash
cd app
npm install
npm run dev
```

Build a static bundle with `npm run build` — the output in `app/dist` is a
plain folder of files that will run from any static host, or straight off disk.

## Licence

MIT — see [LICENSE](LICENSE).
