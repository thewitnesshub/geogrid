import { useEffect, useRef, useState } from 'react'
import styles from '../../theme/chrome.module.css'
import type { ThemeChoice } from '../../lib/types'

const Tick = (
  <svg className={styles.tick} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const icons = {
  system: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  light: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  ),
  counts: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="13" />
      <line x1="12" y1="20" x2="12" y2="7" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </svg>
  ),
  keyboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 13h6" />
    </svg>
  ),
  info: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

interface Props {
  theme: ThemeChoice
  onTheme: (t: ThemeChoice) => void
  onShortcuts: () => void
  onCredits: () => void
}

export function AppMenu({ theme, onTheme, onShortcuts, onCredits }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [open])

  const themeRow = (id: ThemeChoice, label: string) => (
    <button
      className={styles.menuItem}
      type="button"
      role="menuitemradio"
      aria-checked={theme === id}
      onClick={() => onTheme(id)}
    >
      {icons[id]}
      {label}
      {Tick}
    </button>
  )

  return (
    <div className={styles.kebabWrap} ref={wrap}>
      <button
        className={styles.iconBtn}
        type="button"
        data-tip="Menu"
        aria-label="Menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>

      <div className={`${styles.menuDropdown} ${open ? styles.open : ''}`} role="menu">
        <div className={styles.menuLabel}>Appearance</div>
        {themeRow('system', 'System')}
        {themeRow('light', 'Light')}
        {themeRow('dark', 'Dark')}

        <div className={styles.menuSep} />
        <button
          className={styles.menuItem}
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onShortcuts()
          }}
        >
          {icons.keyboard}
          Keyboard shortcuts
          <span className={styles.menuKey}>?</span>
        </button>
        <button
          className={styles.menuItem}
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false)
            onCredits()
          }}
        >
          {icons.info}
          Credits &amp; licences
        </button>
      </div>
    </div>
  )
}
