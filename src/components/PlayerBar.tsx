import { ArrowsOutSimple, Heart, Microphone, PauseCircle, Pause, Play, PictureInPicture, Queue, Repeat, RepeatOnce, Shuffle, SkipBack, SkipForward, SpeakerHigh, SpeakerLow, SpeakerX, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { library, useLibrary } from '../store/library'
import { current, cycleRepeat, next, prev, seek, setFullscreen, setPanel, setVolume, toggle, toggleMute, toggleShuffle, usePlayer, useTime } from '../store/player'
import { navigate } from '../store/router'
import { useSettings } from '../store/settings'
import { openTrackMenu } from './TrackMenu'
import { fmt, Img, Slider } from './ui'

export function Progress() {
  const { position, duration, buffered } = useTime()
  return (
    <div className="progress tabular">
      <span>{fmt(position)}</span>
      <Slider label="Seek" value={position} max={duration || 1} buffered={buffered} onCommit={seek} />
      <span>{fmt(duration)}</span>
    </div>
  )
}

export function Transport({ compact }: { compact?: boolean }) {
  const t = useT()
  const { playing, loading, shuffle, repeat, error } = usePlayer()
  return (
    <div className="btns">
      {!compact && <button className="icon-btn sm" aria-pressed={shuffle} aria-label={t.shuffle} onClick={toggleShuffle}><Shuffle size={18} weight="bold" /></button>}
      <button className="icon-btn" aria-label={t.prev} onClick={prev}><SkipBack size={22} weight="fill" /></button>
      <button className="play" aria-label={playing ? t.pause : t.play} onClick={toggle} title={error ? t.error : undefined}>
        {error ? <WarningCircle size={22} weight="fill" /> : playing ? <Pause size={20} weight="fill" /> : loading ? <PauseCircle size={22} /> : <Play size={20} weight="fill" style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" aria-label={t.next} onClick={() => next()}><SkipForward size={22} weight="fill" /></button>
      {!compact && <button className="icon-btn sm" aria-pressed={repeat !== 'off'} aria-label={`${t.repeat}: ${repeat}`} onClick={cycleRepeat}>
        {repeat === 'one' ? <RepeatOnce size={18} weight="bold" /> : <Repeat size={18} weight="bold" />}
      </button>}
    </div>
  )
}

export function Volume() {
  const t = useT()
  const volume = useSettings((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const v = muted ? 0 : volume
  return (
    <>
      <button className="icon-btn sm" aria-label={t.mute} aria-pressed={muted} onClick={toggleMute}>
        {v === 0 ? <SpeakerX size={18} /> : v < 0.5 ? <SpeakerLow size={18} /> : <SpeakerHigh size={18} />}
      </button>
      <Slider label={t.volume} value={v} max={1} onChange={setVolume} onCommit={setVolume} />
    </>
  )
}

export function PlayerBar() {
  const t = useT()
  usePlayer((s) => s.index)
  const panel = usePlayer((s) => s.panel)
  const liked = useLibrary((s) => s.liked)
  const tr = current()
  const [overlayOpen, setOverlayOpen] = useState(false)
  useEffect(() => window.lumen?.onOverlay(setOverlayOpen), [])
  const isLiked = !!tr && liked.includes(tr.id)

  return (
    <footer className="bar glass" aria-label="Player">
      <div className="np">
        {tr ? <>
          <button className="art" aria-label={t.fullscreen} onClick={() => setFullscreen(true)}><Img src={tr.artwork} alt={tr.title} /></button>
          <div className="txt" onContextMenu={(e) => openTrackMenu(e, tr)}>
            <div className="tt">{tr.title}</div>
            <div className="ta">{tr.artistId ? <button className="linkish" onClick={() => navigate({ name: 'artist', id: tr.artistId! })}>{tr.artist}</button> : tr.artist}</div>
          </div>
          <button className="icon-btn sm" aria-pressed={isLiked} aria-label={isLiked ? t.unlike : t.like} onClick={() => library.toggleLike(tr)}>
            <Heart size={18} weight={isLiked ? 'fill' : 'regular'} />
          </button>
        </> : <span className="faint">{t.nothingPlaying}</span>}
      </div>
      <div className="transport"><Transport /><Progress /></div>
      <div className="tools">
        <button className="icon-btn sm" aria-pressed={panel === 'lyrics'} aria-label={t.lyrics} onClick={() => setPanel('lyrics')}><Microphone size={18} /></button>
        <button className="icon-btn sm" aria-pressed={panel === 'queue'} aria-label={t.queue} onClick={() => setPanel('queue')}><Queue size={18} /></button>
        {window.lumen && <button className="icon-btn sm" aria-pressed={overlayOpen} aria-label={t.miniPlayer} onClick={() => window.lumen!.toggleOverlay()}><PictureInPicture size={18} /></button>}
        <Volume />
        <button className="icon-btn sm" aria-label={t.fullscreen} onClick={() => setFullscreen(true)} disabled={!tr}><ArrowsOutSimple size={18} /></button>
      </div>
    </footer>
  )
}
