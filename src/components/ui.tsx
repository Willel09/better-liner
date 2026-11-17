import { MusicNotesSimple, Play } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from '../store/create'

export const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60), x = Math.floor(s % 60)
  return `${m}:${x.toString().padStart(2, '0')}`
}

export function Img({ src, alt, round }: { src: string | null | undefined; alt: string; round?: boolean }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  return src && !bad
    ? <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setBad(true)} style={round ? { borderRadius: '50%' } : undefined} />
    : <div className="cover-fallback" role="img" aria-label={alt}><MusicNotesSimple size={28} weight="duotone" /></div>
}

export function Card({ title, sub, art, round, onOpen, onPlay, onContext }: {
  title: string; sub?: string; art: string | null; round?: boolean; onOpen(): void; onPlay?(): void; onContext?(e: React.MouseEvent): void
}) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={onOpen} onContextMenu={onContext}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className={'cover' + (round ? ' round' : '')}>
        <Img src={art} alt="" />
        {onPlay && (
          <button className="play-fab fab" aria-label={`Play ${title}`} onClick={(e) => { e.stopPropagation(); onPlay() }}>
            <Play size={18} weight="fill" />
          </button>
        )}
      </div>
      <div style={round ? { textAlign: 'center' } : undefined}>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    </div>
  )
}

export function Slider({ value, max, buffered = 0, onChange, onCommit, label }: {
  value: number; max: number; buffered?: number; onChange?(v: number): void; onCommit(v: number): void; label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const v = drag ?? value
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0
  const at = (x: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * max }
  return (
    <div ref={ref} className={'slider' + (drag !== null ? ' drag' : '')} role="slider" tabIndex={0} aria-label={label}
      aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(v)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const x = at(e.clientX); setDrag(x); onChange?.(x) }}
      onPointerMove={(e) => { if (drag !== null) { const x = at(e.clientX); setDrag(x); onChange?.(x) } }}
      onPointerUp={(e) => { if (drag !== null) { onCommit(at(e.clientX)); setDrag(null) } }}
      onKeyDown={(e) => {
        const step = max / 20
        if (e.key === 'ArrowRight') { e.stopPropagation(); onCommit(Math.min(max, value + step)) }
        if (e.key === 'ArrowLeft') { e.stopPropagation(); onCommit(Math.max(0, value - step)) }
      }}>
      <div className="track">
        <div className="buf" style={{ width: `${max ? Math.min(100, (buffered / max) * 100) : 0}%` }} />
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="knob" style={{ left: `${pct}%` }} />
    </div>
  )
}

export function Empty({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
  return <div className="empty">{icon}<p style={{ maxWidth: '40ch', margin: 0 }}>{text}</p>{children}</div>
}

export function SkeletonGrid({ n = 6 }: { n?: number }) {
  return <div className="grid">{Array.from({ length: n }, (_, i) => <div key={i}><div className="skel" style={{ aspectRatio: '1' }} /><div className="skel" style={{ height: 12, marginTop: 10, width: '70%' }} /></div>)}</div>
}
export function SkeletonRows({ n = 8 }: { n?: number }) {
  return <div className="rows">{Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: 48, margin: '6px 0' }} />)}</div>
}

// ---------- toast ----------
export const useToast = create({ msg: '' })
let toastTimer = 0
export function toast(msg: string) {
  useToast.set({ msg })
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => useToast.set({ msg: '' }), 2200)
}
export function Toast() {
  const msg = useToast((s) => s.msg)
  return msg ? <div className="toast glass strong" role="status">{msg}</div> : null
}

// ---------- prompt dialog (name a playlist etc.) ----------
type PromptReq = { title: string; value: string; ok: string; cancel: string; resolve(v: string | null): void }
const usePrompt = create({ req: null as PromptReq | null })
export const prompt = (title: string, value: string, ok: string, cancel: string) =>
  new Promise<string | null>((resolve) => usePrompt.set({ req: { title, value, ok, cancel, resolve } }))

export function PromptHost() {
  const req = usePrompt((s) => s.req)
  const [v, setV] = useState('')
  useEffect(() => setV(req?.value ?? ''), [req])
  if (!req) return null
  const done = (out: string | null) => { req.resolve(out); usePrompt.set({ req: null }) }
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && done(null)}>
      <form className="dialog glass" role="dialog" aria-label={req.title} onSubmit={(e) => { e.preventDefault(); if (v.trim()) done(v.trim()) }}>
        <h2 style={{ fontSize: 17 }}>{req.title}</h2>
        <label className="field"><input autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label={req.title} maxLength={100} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={() => done(null)}>{req.cancel}</button>
          <button type="submit" className="btn primary" disabled={!v.trim()}>{req.ok}</button>
        </div>
      </form>
    </div>
  )
}
