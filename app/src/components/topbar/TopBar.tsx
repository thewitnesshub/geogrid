import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { AppMenu } from './AppMenu'
import { PlaceSearch } from './PlaceSearch'
import { ExportControl } from './ExportControl'
import type { ThemeChoice } from '../../lib/types'

interface Props {
  theme: ThemeChoice
  onTheme: (t: ThemeChoice) => void
  onShortcuts: () => void
  onCredits: () => void
  searchOpen: boolean
  setSearchOpen: (b: boolean) => void
  layersOpen: boolean
  onLayers: () => void
}

const MagIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
/* Lucide's panel-right. It opens the drawer on the right listing the grids and
   pins you have made, so it names the surface it opens rather than reaching for
   "layers" — which in this app now means the imagery, and wears a satellite
   down in the bottom-left corner. */
const LayerListIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M15 3v18" />
  </svg>
)

export function TopBar(p: Props) {
  const [searchKey, setSearchKey] = useState(0)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  // On narrow screens the bar is collapsed behind the magnifier; the class is
  // harmless at wider widths because the media query is what reveals the bar.
  useEffect(() => {
    document.body.classList.toggle('searchopen', p.searchOpen)
  }, [p.searchOpen])

  return (
    <div className={`${styles.topBar} app-chrome`}>
      <div className={styles.chromeNav}>
        <a
          className={styles.brandLink}
          href="https://osintworkspace.com/"
          aria-label="Back to the OSINT Workspace dashboard"
        >
          <span className={styles.brand}>GeoGrid</span>
        </a>
        <AppMenu
          theme={p.theme}
          onTheme={p.onTheme}
          onShortcuts={p.onShortcuts}
          onCredits={p.onCredits}
        />
      </div>

      <PlaceSearch key={searchKey} onDone={() => p.setSearchOpen(false)} />

      <div className={styles.topRight}>
        <button
          ref={toggleRef}
          className={`${styles.chromeBtn} ${styles.searchToggle} ${p.searchOpen ? styles.active : ''}`}
          type="button"
          data-tip="Search a place"
          data-tip-key="/"
          aria-label="Search a place"
          aria-expanded={p.searchOpen}
          onClick={(e) => {
            e.stopPropagation()
            p.setSearchOpen(!p.searchOpen)
            if (!p.searchOpen) setSearchKey((k) => k + 1)
          }}
        >
          {MagIcon}
        </button>
        <button
          className={`${styles.chromeBtn} ${p.layersOpen ? styles.active : ''}`}
          type="button"
          data-tip="Grids and pins"
          aria-label="Grids and pins"
          aria-expanded={p.layersOpen}
          onClick={p.onLayers}
        >
          {LayerListIcon}
        </button>
        <ExportControl />
      </div>
    </div>
  )
}
