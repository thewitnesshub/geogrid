import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Modal.module.css'
import { SHORTCUT_DOC } from '../../hooks/useShortcuts'

function Shell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const close = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    close.current?.focus()
  }, [])
  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // the backdrop closes, but a click inside the card must not
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.card}>
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <button ref={close} className={styles.close} type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const groups = SHORTCUT_DOC()
  return (
    <Shell title="Keyboard shortcuts" onClose={onClose}>
      {groups.map((grp) => (
        <section key={grp.group}>
          <h3>{grp.group}</h3>
          {grp.rows.map((r) => (
            <div className={styles.scRow} key={r.label}>
              <div className={styles.scLabel}>{r.label}</div>
              <div className={styles.scKeys}>
                {r.caps.map((c) => (
                  <kbd key={c}>{c}</kbd>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </Shell>
  )
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
)

export function CreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="Credits & licences" onClose={onClose}>
      <section>
        <h3>Esri</h3>
        <p>
          World Imagery, Streets and Topographic tiles, and the dated{' '}
          <A href="https://livingatlas.arcgis.com/wayback/">World Imagery Wayback</A> archive —
          sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community. Used under{' '}
          <A href="https://www.esri.com/en-us/legal/terms/full-master-agreement">Esri's terms of use</A>.
        </p>
      </section>
      <section>
        <h3>Copernicus / Sentinel-2</h3>
        <p>
          Sentinel-2 L2A scenes served by{' '}
          <A href="https://planetarycomputer.microsoft.com/">Microsoft Planetary Computer</A> —
          contains modified Copernicus Sentinel data.
        </p>
      </section>
      <section>
        <h3>NASA</h3>
        <p>
          Daily VIIRS corrected-reflectance imagery from{' '}
          <A href="https://nasa-gibs.github.io/gibs-api-docs/">NASA EOSDIS GIBS</A>, part of the
          Earth Observing System Data and Information System.
        </p>
      </section>
      <section>
        <h3>OpenStreetMap</h3>
        <p>
          Standard and Humanitarian basemap tiles ©{' '}
          <A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A> contributors, served
          under the <A href="https://operations.osmfoundation.org/policies/tiles/">OSMF tile usage policy</A>;
          Humanitarian tiles by <A href="https://www.hotosm.org/">HOT</A>.
        </p>
        <p>
          <A href="https://opentopomap.org">OpenTopoMap</A> — OSM data and SRTM elevation, style
          licensed CC-BY-SA.
        </p>
        <p>
          Place and boundary search by <A href="https://nominatim.openstreetmap.org">Nominatim</A>.
          Map data available under the Open Database Licence (ODbL).
        </p>
      </section>
      <section>
        <h3>Software</h3>
        <p>
          <A href="https://leafletjs.com">Leaflet</A> (BSD-2-Clause).
        </p>
      </section>
    </Shell>
  )
}
