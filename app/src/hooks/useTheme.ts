import { useCallback, useEffect, useState } from 'react'
import { readTheme, writeTheme } from '../lib/storage'
import type { ThemeChoice } from '../lib/types'

/**
 * The document head already painted the first frame; this only handles changes:
 * the menu, and the OS flipping while "System" is selected.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme)

  const apply = useCallback((c: ThemeChoice) => {
    const light =
      c === 'light' ||
      (c === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark')
    // Read the field back off the token rather than restating it — a second
    // copy of --osw-bg here is drift waiting to happen, and the browser chrome
    // sitting a shade off the app is exactly how it shows up.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--osw-bg').trim()
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg)
  }, [])

  useEffect(() => {
    apply(choice)
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => apply(choice)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice, apply])

  const set = useCallback((c: ThemeChoice) => {
    writeTheme(c)
    setChoice(c)
  }, [])

  return { choice, set }
}
