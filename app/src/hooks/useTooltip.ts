import { useEffect } from 'react'
import { HAS_MOUSE } from '../lib/platform'
import './tooltip.css'

const DELAY = 110
/** How long the group stays "warm" — sliding along a toolbar reveals instantly. */
const WARM = 500

/**
 * One floating node, moved and re-filled per target. Bound by delegation to
 * [data-tip], so anything that gains the attribute later is covered without
 * re-registering. Opens on a short delay, but once one has been seen the next
 * appears immediately instead of re-waiting.
 */
export function useTooltipEngine() {
  useEffect(() => {
    if (!HAS_MOUSE) return

    const tip = document.createElement('div')
    tip.id = 'gg-tip'
    document.body.appendChild(tip)

    let target: HTMLElement | null = null
    let timer: number | undefined
    let warmUntil = 0

    const hide = () => {
      window.clearTimeout(timer)
      if (target) {
        warmUntil = Date.now() + WARM
        target = null
      }
      tip.classList.remove('show', 'instant')
    }

    const place = (el: HTMLElement) => {
      const text = el.getAttribute('data-tip')
      if (!text) return
      tip.textContent = text
      const key = el.getAttribute('data-tip-key')
      if (key) {
        const k = document.createElement('span')
        k.className = 'tip-key'
        k.textContent = key
        tip.appendChild(k)
      }
      // measure before choosing a side, then clamp inside the viewport
      tip.style.left = '-9999px'
      tip.classList.add('show')
      const r = el.getBoundingClientRect()
      const tw = tip.offsetWidth
      const th = tip.offsetHeight
      const gap = 9
      const below = r.top < window.innerHeight / 2
      const top = below ? r.bottom + gap : r.top - th - gap
      let left = Math.round(r.left + r.width / 2 - tw / 2)
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8))
      tip.style.setProperty('--tip-off', below ? '4px' : '-4px')
      tip.style.setProperty('--tip-origin', below ? '50% 0' : '50% 100%')
      tip.style.left = `${left}px`
      tip.style.top = `${Math.round(top)}px`
    }

    const show = (el: HTMLElement) => {
      target = el
      tip.classList.toggle('instant', Date.now() < warmUntil)
      place(el)
    }

    const tipFor = (n: EventTarget | null) =>
      n instanceof Element ? (n.closest('[data-tip]') as HTMLElement | null) : null

    const onOver = (e: PointerEvent) => {
      const el = tipFor(e.target)
      if (!el || el === target) return
      if ((el as HTMLButtonElement).disabled) return hide()
      window.clearTimeout(timer)
      const wasWarm = Date.now() < warmUntil
      target = null
      if (wasWarm) show(el)
      else timer = window.setTimeout(() => show(el), DELAY)
    }
    const onOut = (e: PointerEvent) => {
      if (!target && !timer) return
      if (e.relatedTarget && tipFor(e.relatedTarget) === tipFor(e.target)) return
      hide()
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    // a press is an answer to "what is this?", so the label has done its job
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('keydown', hide, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('blur', hide)

    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('keydown', hide, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('blur', hide)
      tip.remove()
    }
  }, [])
}
