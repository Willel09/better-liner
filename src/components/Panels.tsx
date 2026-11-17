import { ArrowsInSimple, DotsThree, Microphone, Queue as QueueIcon, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../lib/i18n'
import { clearUpNext, current, moveInQueue, playAt, removeFromQueue, setFullscreen, setPanel, usePlayer } from '../store/player'
import { Lyrics } from './Lyrics'
import { Progress, Transport, Volume } from './PlayerBar'
import { Eq } from './TrackList'
import { openTrackMenu } from './TrackMenu'
import { Empty, fmt, Img } from './ui'
import { Visualizer } from './Visualizer'

export function SidePanel() {
  const t = useT()
  const panel = usePlayer((s) => s.panel)
  if (!panel) return null
  return (
    <aside className="panel glass" aria-label={panel === 'queue' ? t.queue : t.lyrics}>
      <div className="panel-head">
        <h2>{panel === 'queue' ? t.queue : t.lyrics}</h2>
        <button className="icon-btn sm" aria-label={t.close} onClick={() => setPanel(panel)}><X size={18} /></button>
      </div>
      <div className="panel-body">{panel === 'queue' ? <QueueList /> : <Lyrics />}</div>
    </aside>
  )
}

function QueueList() {
  const t = useT()
  const { queue, index, playing } = usePlayer()
  const [from, setFrom] = useState<number | null>(null)
  if (!queue.length) return <Empty icon={<QueueIcon size={36} weight="duotone" />} text={t.nothingPlaying} />
  const row = (i: number) => {
    const tr = queue[i]
    return (
      <div key={tr.id + i} className={'row compact' + (from === i ? ' dragging' : '')} aria-current={i === index}
        draggable={i > index} onDragStart={() => setFrom(i)} onDragOver={(e) => i > index && e.preventDefault()}
        onDrop={() => { if (from !== null && from !== i) moveInQueue(from, i); setFrom(null) }} onDragEnd={() => setFrom(null)}
        onDoubleClick={() => playAt(i)} onContextMenu={(e) => openTrackMenu(e, tr)}>
        <div className="art"><Img src={tr.artwork} alt="" /></div>
        <div style={{ minWidth: 0 }}><div className="rt">{tr.title}</div><div className="ra">{tr.artist}</div></div>
        <div className="d tabular">{i === index ? <Eq paused={!playing} /> : fmt(tr.duration)}</div>
        {i === index
          ? <button className="icon-btn sm hide" aria-label={t.more} onClick={(e) => openTrackMenu(e, tr)}><DotsThree size={18} weight="bold" /></button>
          : <button className="icon-btn sm hide" aria-label={t.remove} onClick={() => removeFromQueue(i)}><X size={16} /></button>}
      </div>
    )
  }
  const upNext = queue.length - index - 1
  return (
    <>
      {index >= 0 && <><div className="eyebrow" style={{ padding: '4px 10px' }}>{t.nowPlaying}</div>{row(index)}</>}
      {upNext > 0 && <div className="eyebrow" style={{ padding: '16px 10px 4px', display: 'flex', justifyContent: 'space-between' }}>
        {t.upNext}<button className="linkish faint" onClick={clearUpNext}>{t.clearQueue}</button>
      </div>}
      {queue.map((_, i) => (i > index ? row(i) : null))}
    </>
  )
}

export function Fullscreen() {
  const t = useT()
  const fullscreen = usePlayer((s) => s.fullscreen)
  const playing = usePlayer((s) => s.playing)
  usePlayer((s) => s.index)
  const [showLyrics, setShowLyrics] = useState(true)
  const tr = current()
  if (!fullscreen || !tr) return null
  return (
    <div className={'full' + (showLyrics ? '' : ' no-lyrics')} role="dialog" aria-label={t.fullscreen}>
      <Visualizer art={tr.artwork} />
      <button className="icon-btn close" aria-label={t.exitFullscreen} onClick={() => setFullscreen(false)}><ArrowsInSimple size={20} /></button>
      <div className="left">
        <div className={'art' + (playing ? '' : ' paused')}><Img src={tr.artwork} alt={tr.title} /></div>
        <div style={{ width: 'min(42vh, 440px)' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{tr.title}</h1>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 2 }}>{tr.artist}</div>
        </div>
        <div className="ctrl glass">
          <Progress />
          <div className="transport" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <button className="icon-btn sm" aria-pressed={showLyrics} aria-label={t.lyrics} onClick={() => setShowLyrics(!showLyrics)}><Microphone size={18} /></button>
            <Transport compact />
            <div className="vol"><Volume /></div>
          </div>
        </div>
      </div>
      {showLyrics && <div className="right"><Lyrics big /></div>}
    </div>
  )
}
