import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import { AppMenu } from './AppMenu'
import { PlaceSearch } from './PlaceSearch'
import { BasemapControl } from './BasemapControl'
import { ExportControl } from './ExportControl'
import type { ThemeChoice } from '../../lib/types'

interface Props {
  theme: ThemeChoice
  onTheme: (t: ThemeChoice) => void
  statsShown: boolean
  onStats: (b: boolean) => void
  onShortcuts: () => void
  onCredits: () => void
  searchOpen: boolean
  setSearchOpen: (b: boolean) => void
}

const MagIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
          statsShown={p.statsShown}
          onStats={p.onStats}
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
        <ExportControl />
        <BasemapControl />
      </div>
    </div>
  )
}
