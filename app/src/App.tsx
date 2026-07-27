import { useCallback, useEffect, useRef, useState } from 'react'
import { GridProvider, useGrid } from './state/GridStore'
import { ToastProvider } from './hooks/useToast'
import { useTooltipEngine } from './hooks/useTooltip'
import { useTheme } from './hooks/useTheme'
import { useShortcuts } from './hooks/useShortcuts'
import { readStatsShown, writeStatsShown } from './lib/storage'
import { HAS_MOUSE, PAINT_KEY } from './lib/platform'
import { MapCanvas } from './components/map/MapCanvas'
import { TopBar } from './components/topbar/TopBar'
import { Toolbox } from './components/rail/Toolbox'
import { DateControl, FocusExit, GridNote, ModeBadge, StatsBar } from './components/overlay/Overlays'
import { CreditsModal, ShortcutsModal } from './components/modals/Modals'
import type { DatedEntry } from './lib/datedSources'
import './theme/base.css'

type DatedState = { entries: DatedEntry[]; meta: string; index: number } | null

function Shell() {
  const g = useGrid()
  const theme = useTheme()
  useTooltipEngine()

  const [statsShown, setStatsShown] = useState(readStatsShown)
  const [modal, setModal] = useState<null | 'shortcuts' | 'credits'>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [dated, setDated] = useState<DatedState>(null)
  const [datedIndex, setDatedIndex] = useState(0)

  // ---- the hint badge ----
  const [badge, setBadge] = useState('')
  const [fading, setFading] = useState(false)
  const marks = useRef(0)
  const fadeT = useRef<number | undefined>(undefined)
  // Who put the badge up. Draw mode ending must not wipe the hint that the new
  // grid just raised, so a clear only lands if it comes from the same owner.
  type Owner = 'draw' | 'brush' | 'mod' | 'hint' | null
  const owner = useRef<Owner>(null)

  const showBadge = useCallback((text: string, by: Owner) => {
    window.clearTimeout(fadeT.current)
    setFading(false)
    owner.current = by
    setBadge(text)
    marks.current = 0
  }, [])

  const clearBadge = useCallback((by: Owner) => {
    if (owner.current !== by) return
    window.clearTimeout(fadeT.current)
    setFading(false)
    owner.current = null
    setBadge('')
  }, [])

  /** A hint that has watched you do the thing twice has stopped being help. */
  const noteCellMarked = useCallback(() => {
    if (marks.current >= 2) return
    if (++marks.current >= 2) {
      setFading(true)
      fadeT.current = window.setTimeout(() => {
        owner.current = null
        setBadge('')
        setFading(false)
      }, 700)
    }
  }, [])

  // Raised the moment a grid exists, which is the first time the modifier means
  // anything — before that there are no cells to brush.
  const onGridCreated = useCallback(() => {
    showBadge(
      `Click cells to mark them${HAS_MOUSE ? ` · hold ${PAINT_KEY} and drag to brush` : ''}`,
      'hint',
    )
  }, [showBadge])

  // Holding the modifier really does change the map — dragging is off and cells
  // paint — so it announces itself, unless a tool already owns the badge.
  const onModifierMode = useCallback(
    (on: boolean) => {
      if (on) {
        if (g.drawing || g.paintArmed) return
        showBadge('Brush mode · drag across cells', 'mod')
      } else clearBadge('mod')
    },
    [g.drawing, g.paintArmed, showBadge, clearBadge],
  )

  useEffect(() => {
    if (g.drawing) showBadge('Drag a box on the map to draw your search area', 'draw')
    else clearBadge('draw')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.drawing])

  useEffect(() => {
    if (g.paintArmed) {
      showBadge(
        `Drag across cells to mark or clear them${HAS_MOUSE ? ` · holding ${PAINT_KEY} does this without the brush` : ''}`,
        'brush',
      )
    } else clearBadge('brush')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.paintArmed])

  useEffect(() => {
    document.body.classList.toggle('focus', g.focus)
  }, [g.focus])

  const onStats = (b: boolean) => {
    writeStatsShown(b)
    setStatsShown(b)
  }

  useShortcuts({
    draw: () => g.setDrawing(!g.drawing),
    region: () => document.querySelector<HTMLButtonElement>('[data-tip="Fill a region"]')?.click(),
    size: () => document.querySelector<HTMLButtonElement>('[data-tip="Cell size"]')?.click(),
    brush: () => g.cells.length && g.setPaintArmed(!g.paintArmed),
    basemap: () => document.querySelector<HTMLButtonElement>('[data-tip="Choose basemap"]')?.click(),
    exportKml: () => document.querySelector<HTMLButtonElement>('[data-tip="Export to KML"]')?.click(),
    focus: () => g.setFocus(!g.focus),
    search: () => {
      setSearchOpen(true)
      window.setTimeout(
        () => document.querySelector<HTMLInputElement>('input[aria-label="Place or coordinates"]')?.focus(),
        0,
      )
    },
    shortcuts: () => setModal('shortcuts'),
    escape: () => {
      // back out one layer at a time
      if (modal) return setModal(null)
      if (g.focus) return g.setFocus(false)
      if (g.drawing) g.setDrawing(false)
      if (g.paintArmed) g.setPaintArmed(false)
    },
  })

  return (
    <div className="mapwrap">
      <MapCanvas
        onGridCreated={onGridCreated}
        onCellMarked={noteCellMarked}
        onModifierMode={onModifierMode}
        onDatedState={(s) => {
          setDated(s)
          if (s) setDatedIndex(s.index)
        }}
        datedIndex={datedIndex}
      />

      <TopBar
        theme={theme.choice}
        onTheme={theme.set}
        statsShown={statsShown}
        onStats={onStats}
        onShortcuts={() => setModal('shortcuts')}
        onCredits={() => setModal('credits')}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
      />

      <DateControl state={dated} onIndex={setDatedIndex} />
      <ModeBadge text={badge} fading={fading} />
      <GridNote />
      <Toolbox />
      <StatsBar shown={statsShown} />
      {g.focus && <FocusExit onExit={() => g.setFocus(false)} />}

      {modal === 'shortcuts' && <ShortcutsModal onClose={() => setModal(null)} />}
      {modal === 'credits' && <CreditsModal onClose={() => setModal(null)} />}
    </div>
  )
}

export default function App() {
  return (
    <GridProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </GridProvider>
  )
}
