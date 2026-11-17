import { useEffect, useRef } from 'react'
import { getAnalyser, usePlayer } from '../store/player'
import { useSettings } from '../store/settings'

// Reactive background: palette sampled from the artwork, drawn as slow-moving blurred blobs
// whose size and brightness follow the bass/mid energy from the analyser.
async function palette(src: string | null): Promise<string[]> {
  const fallback = ['#ff6f61', '#3b2a5a', '#1d4e6b', '#7a3b2e']
  if (!src) return fallback
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  try { await img.decode() } catch { return fallback }
  const c = document.createElement('canvas'); c.width = c.height = 12
  const g = c.getContext('2d', { willReadFrequently: true })!
  try {
    g.drawImage(img, 0, 0, 12, 12)
    const d = g.getImageData(0, 0, 12, 12).data
    const px: [number, number, number, number][] = []
    for (let i = 0; i < d.length; i += 4) {
      const [r, gg, b] = [d[i], d[i + 1], d[i + 2]]
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
      px.push([r, gg, b, (mx - mn) + mx * 0.3]) // favor saturated, bright pixels
    }
    px.sort((a, b) => b[3] - a[3])
    return [0, 6, 18, 40, 80].map((i) => px[Math.min(i, px.length - 1)]).map(([r, gg, b]) => `rgb(${r},${gg},${b})`)
  } catch { return fallback } // tainted canvas (no CORS on artwork)
}

export function Visualizer({ art }: { art: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const colors = useRef<string[]>([])
  const reactive = useSettings((s) => s.visuals)

  useEffect(() => { palette(art).then((p) => (colors.current = p)) }, [art])

  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!
    const bins = new Uint8Array(256)
    let raf = 0, energy = 0, t0 = performance.now()
    const resize = () => { cv.width = innerWidth / 3; cv.height = innerHeight / 3 } // low-res + CSS blur = cheap & soft
    resize(); addEventListener('resize', resize)
    const draw = () => {
      const a = getAnalyser()
      let bass = 0
      if (a && reactive && usePlayer.get().playing) {
        a.getByteFrequencyData(bins)
        for (let i = 1; i < 12; i++) bass += bins[i]
        bass /= 11 * 255
      }
      energy += (bass - energy) * 0.18
      const t = (performance.now() - t0) / 1000, W = cv.width, H = cv.height
      g.globalCompositeOperation = 'source-over'
      g.fillStyle = '#07070b'; g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'lighter'
      colors.current.forEach((c, i) => {
        const x = W * (0.5 + 0.38 * Math.sin(t * (0.07 + i * 0.023) + i * 1.7))
        const y = H * (0.5 + 0.36 * Math.cos(t * (0.06 + i * 0.019) + i * 2.3))
        const r = Math.max(W, H) * (0.32 + 0.05 * i + energy * 0.28)
        const grd = g.createRadialGradient(x, y, 0, x, y, r)
        grd.addColorStop(0, c); grd.addColorStop(1, 'transparent')
        g.globalAlpha = 0.42 + energy * 0.4
        g.fillStyle = grd; g.fillRect(0, 0, W, H)
      })
      g.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  }, [reactive])

  return <canvas ref={ref} className="viz" style={{ filter: 'blur(40px) saturate(140%)', transform: 'scale(1.15)' }} aria-hidden />
}
