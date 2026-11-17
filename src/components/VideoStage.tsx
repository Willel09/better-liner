import { useEffect } from 'react'
import { current, stage } from '../store/player'

// Keeps the (single, persistent) YouTube player stage glued to whichever placeholder is on screen.
// Moving an iframe in the DOM would reload it, so we move the stage with fixed positioning instead.
export function VideoStage() {
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const slot = document.querySelector<HTMLElement>('[data-video-slot="big"]') ?? document.querySelector<HTMLElement>('[data-video-slot="tile"]')
      const t = current()
      const show = !!slot && !!t && t.source !== 'local'
      stage.classList.toggle('hidden', !show)
      if (slot && show) {
        const r = slot.getBoundingClientRect()
        const st = stage.style
        st.left = r.left + 'px'; st.top = r.top + 'px'; st.width = r.width + 'px'; st.height = r.height + 'px'
        st.borderRadius = getComputedStyle(slot).borderRadius
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return null
}
