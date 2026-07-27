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
    document
      .querySelector('meta[name=theme-color]')
      ?.setAttribute('content', light ? '#f3f4f8' : '#0e1015')
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
