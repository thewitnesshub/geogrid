import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('')
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((m: string) => {
    setMsg(m)
    setShown(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShown(false), 1800)
  }, [])

  return (
    <Ctx.Provider value={toast}>
      {children}
      <ToastView msg={msg} shown={shown} />
    </Ctx.Provider>
  )
}

import styles from '../theme/chrome.module.css'

function ToastView({ msg, shown }: { msg: string; shown: boolean }) {
  return (
    <div className={`${styles.toast} ${shown ? styles.show : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
}

export const useToast = () => useContext(Ctx)
