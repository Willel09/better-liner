import { Heart, Pause, Play, SkipBack, SkipForward, X } from '@phosphor-icons/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'
import { Img } from './components/ui'
import { emit, listen } from './lib/api'
import type { Track } from './lib/types'

type State = { track: Track | null; playing: boolean; position: number; duration: number; liked: boolean }

// Floating always-on-top mini player window. It only shows state and sends commands;
// playback stays in the main window.
export function Mini() {
  const [s, setS] = useState<State>({ track: null, playing: false, position: 0, duration: 0, liked: false })
  useEffect(() => {
    const off = listen<State>('player:state', setS)
    emit('player:command', 'hello')
    return off
  }, [])
  const cmd = (c: string) => emit('player:command', c)
  const tr = s.track
  return (
    <div className="overlay glass strong" data-tauri-drag-region onMouseDown={(e) => { if (e.target === e.currentTarget) getCurrentWindow().startDragging() }}>
      <div className="art"><Img src={tr?.artwork} alt={tr?.title ?? ''} /></div>
      <div style={{ minWidth: 0 }} data-tauri-drag-region>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }} data-tauri-drag-region>
          <div style={{ minWidth: 0 }} data-tauri-drag-region>
            <div style={{ fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr?.title ?? 'Echo'}</div>
            <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr?.artist ?? ''}</div>
          </div>
          <button className="icon-btn sm" style={{ width: 28, height: 28, marginTop: -4 }} aria-label="Close" onClick={() => getCurrentWindow().close()}><X size={14} /></button>
        </div>
        <div className="btns">
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
