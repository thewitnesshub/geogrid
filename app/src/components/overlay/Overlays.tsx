import styles from '../../theme/chrome.module.css'
import { useGrid } from '../../state/GridStore'
import type { DatedEntry } from '../../lib/datedSources'
import type { EsriImageryMeta } from '../../lib/types'

export function ModeBadge({ text, fading }: { text: string; fading: boolean }) {
  if (!text) return null
  return (
    <div className={`${styles.modeBadge} ${fading ? styles.fading : ''} app-chrome`}>{text}</div>
  )
}

export function GridNote() {
  const g = useGrid()
  if (!g.gridNote) return null
  return <div className={`${styles.gridNote} app-chrome`}>{g.gridNote}</div>
}

export function FocusExit({ onExit }: { onExit: () => void }) {
  return (
    <button
      className={styles.focusExit}
      type="button"
      data-tip="Leave focus mode"
      data-tip-key="Esc"
      aria-label="Leave focus mode"
      onClick={onExit}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" />
        <path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
      </svg>
    </button>
  )
}

interface DateProps {
  state: { entries: DatedEntry[]; meta: string; index: number } | null
  onIndex: (i: number) => void
}

/** One control for all three dated sources — they differ only in their entries. */
export function DateControl({ state, onIndex }: DateProps) {
  if (!state) return null
  const { entries, meta, index } = state
  return (
    <div className={`${styles.dateCtl} ${styles.show} app-chrome`}>
      <div className={styles.senRow}>
        <button
          type="button"
          title="Earlier pass"
          aria-label="Earlier pass"
          disabled={index >= entries.length - 1}
          onClick={() => onIndex(index + 1)}
        >
          ‹
        </button>
        <select
          aria-label="Imagery date"
          value={index}
          onChange={(e) => onIndex(+e.target.value)}
          disabled={!entries.length}
        >
          {entries.map((e, i) => (
            <option key={e.label + i} value={i}>
              {e.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          title="Later pass"
          aria-label="Later pass"
          disabled={index <= 0}
          onClick={() => onIndex(index - 1)}
        >
          ›
        </button>
      </div>
      <div className={styles.senMeta}>{meta}</div>
    </div>
  )
}

export function EsriDateBadge({ meta }: { meta: EsriImageryMeta | null }) {
  if (!meta) return null
  return (
    <div
      className={`${styles.dateCtl} ${styles.show} ${styles.esriDate} app-chrome`}
      title="Imagery acquisition date at map centre"
    >
      <strong>{meta.date}</strong>
    </div>
  )
}
