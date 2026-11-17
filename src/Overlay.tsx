import { Heart, Pause, Play, SkipBack, SkipForward, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Img } from './components/ui'
import type { Track } from './lib/types'

type State = { track: Track | null; playing: boolean; position: number; duration: number; liked: boolean }

// Floating always-on-top mini player. Lives in its own window; talks to the main window via IPC.
export function Overlay() {
  const [s, setS] = useState<State>({ track: null, playing: false, position: 0, duration: 0, liked: false })
  useEffect(() => window.lumen?.onState(setS), [])
  const cmd = (c: string) => window.lumen?.sendCommand(c)
  const tr = s.track
  return (
    <div className="overlay glass strong">
      <div className="art"><Img src={tr?.artwork} alt={tr?.title ?? ''} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr?.title ?? 'Lumen'}</div>
            <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr?.artist ?? ''}</div>
          </div>
          <button className="icon-btn sm no-drag" style={{ width: 28, height: 28, marginTop: -4 }} aria-label="Close" onClick={() => window.lumen?.toggleOverlay()}><X size={14} /></button>
        </div>
        <div className="btns no-drag">
          <button className="icon-btn sm" aria-label="Like" aria-pressed={s.liked} onClick={() => cmd('like')}><Heart size={16} weight={s.liked ? 'fill' : 'regular'} /></button>
          <button className="icon-btn sm" aria-label="Previous" onClick={() => cmd('prev')}><SkipBack size={18} weight="fill" /></button>
          <button className="icon-btn" aria-label={s.playing ? 'Pause' : 'Play'} onClick={() => cmd('toggle')}>{s.playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}</button>
          <button className="icon-btn sm" aria-label="Next" onClick={() => cmd('next')}><SkipForward size={18} weight="fill" /></button>
        </div>
        <div className="mini-prog"><i style={{ width: `${s.duration ? (s.position / s.duration) * 100 : 0}%` }} /></div>
      </div>
    </div>
  )
}
