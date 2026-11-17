import { ArrowsOutSimple, Heart, Moon, Pause, PictureInPicture, Play, Queue, Repeat, RepeatOnce, Shuffle, SkipBack, SkipForward, SpeakerHigh, SpeakerLow, SpeakerX, Spinner, WarningCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { api, errText, isTauri } from '../lib/api'
import { useT } from '../lib/i18n'
import { primaryArtist } from '../lib/tracks'
import { useMini } from '../store/bridge'
import { library, useLibrary } from '../store/library'
import { current, cycleRepeat, next, prev, seek, setSleep, setVolume, toggle, toggleMute, toggleShuffle, usePlayer, useTime } from '../store/player'
import { navigate, useRouter } from '../store/router'
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
  const sv = useSettings((s) => s.lang) === 'sv'
  return (
    <div className="btns">
      {!compact && <button className="icon-btn sm" aria-pressed={shuffle} aria-label={t.shuffle} title={t.smartShuffle} onClick={toggleShuffle}><Shuffle size={18} weight="bold" /></button>}
      <button className="icon-btn" aria-label={t.prev} onClick={prev}><SkipBack size={22} weight="fill" /></button>
      <button className="play" aria-label={playing ? t.pause : t.play} onClick={toggle} title={error ? errText(error, sv) : undefined}>
        {error ? <WarningCircle size={22} weight="fill" /> : playing ? <Pause size={20} weight="fill" /> : loading ? <Spinner size={20} className="spin" /> : <Play size={20} weight="fill" style={{ marginLeft: 2 }} />}
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

function SleepButton() {
  const t = useT()
  const sleepAt = usePlayer((s) => s.sleepAt)
  const [open, setOpen] = useState(false)
  const left = sleepAt > 0 ? Math.ceil((sleepAt - Date.now()) / 60000) : 0
  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn sm" aria-pressed={sleepAt !== 0} aria-label={t.sleepTimer} title={sleepAt > 0 ? `${left} min` : t.sleepTimer} onClick={() => setOpen(!open)}><Moon size={18} /></button>
      {open && (
        <div className="menu glass" role="menu" style={{ position: 'absolute', bottom: 48, right: 0, left: 'auto', top: 'auto' }} onMouseLeave={() => setOpen(false)}>
          <div className="sub-label">{t.sleepTimer}</div>
          {[[0, t.sleepOff], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 h'], [-1, t.sleepEnd]].map(([m, l]) => (
            <button key={m} role="menuitem" onClick={() => { setSleep(m as number); setOpen(false) }}>{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PlayerBar() {
  const t = useT()
  usePlayer((s) => s.index)
  const liked = useLibrary((s) => s.liked)
  const miniOpen = useMini((s) => s.open)
  const onNow = useRouter((s) => s.stack[s.pos].name === 'now')
  const tr = current()
  const isLiked = !!tr && liked.includes(tr.id)

  return (
    <footer className="bar glass" aria-label="Player">
      <div className="np">
        {tr ? <>
          <button className="art" aria-label={t.now} onClick={() => navigate({ name: 'now' })}><Img src={tr.artwork} alt={tr.title} /></button>
          <div className="txt" onContextMenu={(e) => openTrackMenu(e, tr)}>
            <div className="tt">{tr.title}</div>
            <div className="ta"><button className="linkish" onClick={() => navigate({ name: 'artist', name_: primaryArtist(tr.artist) })}>{tr.artist}</button></div>
          </div>
          <button className="icon-btn sm" aria-pressed={isLiked} aria-label={isLiked ? t.unlike : t.like} onClick={() => library.toggleLike(tr)}>
            <Heart size={18} weight={isLiked ? 'fill' : 'regular'} />
          </button>
        </> : <span className="faint">{t.nothingPlaying}</span>}
      </div>
      <div className="transport"><Transport /><Progress /></div>
      <div className="tools">
        <SleepButton />
        <button className="icon-btn sm" aria-pressed={onNow} aria-label={t.queue} onClick={() => navigate({ name: 'now' })}><Queue size={18} /></button>
        {isTauri && <button className="icon-btn sm" aria-pressed={miniOpen} aria-label={t.miniPlayer} onClick={() => api.miniToggle()}><PictureInPicture size={18} /></button>}
        <Volume />
        <button className="icon-btn sm" aria-label={t.now} onClick={() => navigate({ name: 'now' })} disabled={!tr}><ArrowsOutSimple size={18} /></button>
      </div>
    </footer>
  )
}
