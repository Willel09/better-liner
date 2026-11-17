import { YoutubeLogo, Broadcast, DotsThree, MagicWand, Microphone, MusicNotes, Queue as QueueIcon, Sparkle, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Lyrics } from '../components/Lyrics'
import { Progress, Transport, Volume } from '../components/PlayerBar'
import { Eq, TrackList } from '../components/TrackList'
import { openTrackMenu, startRadio } from '../components/TrackMenu'
import { Empty, fmt, Img, SkeletonRows, toast } from '../components/ui'
import { Visualizer } from '../components/Visualizer'
import { analyzeTracks, similarTo } from '../lib/ai'
import { api, errText } from '../lib/api'
import { useT } from '../lib/i18n'
import { create } from '../store/create'
import { useLibrary } from '../store/library'
import { clearUpNext, current, moveInQueue, playAt, removeFromQueue, usePlayer } from '../store/player'
import { useSettings } from '../store/settings'
import { useStatus } from '../store/status'
import { ErrorState } from './common'
import { useAsync } from './hooks'

// AI DJ commentary for the running set: intro + lines placed before given queue positions.
export const useDj = create({ intro: '', segues: [] as { at: number; text: string }[], baseIndex: 0 })

function speak(text: string) {
  if (!useSettings.get().djVoice || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = useSettings.get().lang === 'sv' ? 'sv-SE' : 'en-US'
  speechSynthesis.cancel(); speechSynthesis.speak(u)
}

function DjCard() {
  const t = useT()
  const dj = useDj()
  const index = usePlayer((s) => s.index)
  const line = index === dj.baseIndex && dj.intro ? dj.intro : dj.segues.find((s) => s.at + dj.baseIndex === index)?.text
  useEffect(() => { if (line) speak(line) }, [line])
  if (!line) return null
  return (
    <div className="dj-card glass">
      <Sparkle size={20} weight="fill" style={{ color: 'var(--accent)', flex: 'none', marginTop: 2 }} />
      <div><div className="eyebrow">{t.djSays}</div><div style={{ marginTop: 2 }}>{line}</div></div>
    </div>
  )
}

function QueueList() {
  const t = useT()
  const { queue, index, playing, radioBusy } = usePlayer()
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
        <div style={{ minWidth: 0 }}><div className="rt">{tr.source === 'ref' && <span className="ref-dot" />}{tr.title}</div><div className="ra">{tr.artist}</div></div>
        <div className="d tabular">{i === index ? <Eq paused={!playing} /> : tr.duration ? fmt(tr.duration) : ''}</div>
        {i === index
          ? <button className="icon-btn sm hide" aria-label={t.more} onClick={(e) => openTrackMenu(e, tr)}><DotsThree size={18} weight="bold" /></button>
          : <button className="icon-btn sm hide" aria-label={t.remove} onClick={() => removeFromQueue(i)}><X size={16} /></button>}
      </div>
    )
  }
  return (
    <div style={{ padding: '4px 8px 16px' }}>
      {index >= 0 && <><div className="eyebrow" style={{ padding: '4px 10px' }}>{t.nowPlaying}</div>{row(index)}</>}
      {queue.length - index - 1 > 0 && <div className="eyebrow" style={{ padding: '16px 10px 4px', display: 'flex', justifyContent: 'space-between' }}>
        {t.upNext}<button className="linkish faint" onClick={clearUpNext}>{t.clearQueue}</button>
      </div>}
      {queue.map((_, i) => (i > index ? row(i) : null))}
      {radioBusy && <div className="faint" style={{ padding: 12, fontSize: 12 }}><Broadcast size={14} style={{ verticalAlign: -2 }} /> {t.smartRadio}…</div>}
    </div>
  )
}

function SimilarList() {
  const st = useStatus()
  const tr = current()
  const res = useAsync(() => similarTo(tr!, 12), [tr?.id], !!tr && st.ai)
  const why = useMemo(() => Object.fromEntries((res.data ?? []).map((p) => [p.id, p.why ?? ''])), [res.data])
  if (!st.ai) return <ErrorState error="ai:nokey" />
  if (res.loading) return <div style={{ padding: 12 }}><SkeletonRows n={6} /></div>
  if (res.error) return <ErrorState error={res.error} retry={res.retry} />
  return <div style={{ padding: '4px 8px' }}><TrackList tracks={res.data ?? []} why={why} showFeatures={false} /></div>
}

export function NowPlaying() {
  const t = useT()
  usePlayer((s) => s.index)
  const tr = current()
  const f = useLibrary((s) => (tr ? s.features[tr.id] : undefined))
  const [tab, setTab] = useState<'lyrics' | 'queue' | 'similar'>('lyrics')
  const sv = useSettings((s) => s.lang) === 'sv'
  if (!tr) return <div className="page"><Empty icon={<MusicNotes size={44} weight="duotone" />} text={t.nothingPlaying} /></div>
  const isYt = tr.source === 'yt' || tr.source === 'ref'
  return (
    <>
      <div className="np-bg" aria-hidden><Visualizer art={tr.artwork} /></div>
      <div className="page np-page" style={{ position: 'relative' }}>
        <div className="np-left">
          {/* YouTube's player is docked here while this page is open; local files show their cover. */}
          <div className={'np-media' + (isYt ? '' : ' square')} data-video-slot={isYt ? 'big' : undefined}>
            {!isYt && <Img src={tr.artwork} alt={tr.title} />}
          </div>
          <div>
            <h1 className="h-hero" style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', color: '#fff' }}>{tr.title}</h1>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 17, marginTop: 4 }}>{tr.artist}</div>
            <div className="row-gap" style={{ marginTop: 12 }}>
              {f?.mood && <span className="pill accent">{t.moods[f.mood as keyof typeof t.moods] ?? f.mood}</span>}
              {(f?.genre || tr.genre) && <span className="pill">{f?.genre ?? tr.genre}</span>}
              {f?.bpm ? <span className="pill tabular">{Math.round(f.bpm)} BPM{f.by === 'local' ? ' ✓' : ''}</span> : null}
              {f?.energy !== undefined && <span className="pill tabular">⚡ {Math.round(f.energy * 100)}%</span>}
              {!f?.mood && <button className="chip" onClick={() => analyzeTracks([tr]).then(() => toast(t.analyzed), (e) => toast(errText(e, sv)))}><MagicWand size={13} /> {t.analyzeNow}</button>}
              {tr.source === 'ytm'
                ? <button className="chip" onClick={() => api.ytmOpen()}><YoutubeLogo size={13} /> {t.openYtm}</button>
                : <button className="chip" onClick={() => startRadio(tr, sv)}><Broadcast size={13} /> {t.startRadio}</button>}
            </div>
          </div>
          <div className="ctrl glass" style={{ borderRadius: 26, padding: '14px 16px 12px', '--glass': 'rgba(255,255,255,0.08)', '--text': '#fff', '--text-2': 'rgba(255,255,255,0.75)', '--text-3': 'rgba(255,255,255,0.6)', '--base': '#111', '--fill-hover': 'rgba(255,255,255,0.12)', '--fill-press': 'rgba(255,255,255,0.22)' } as React.CSSProperties}>
            <Progress />
            <div className="transport" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Transport />
              <div className="vol"><Volume /></div>
            </div>
          </div>
          <DjCard />
        </div>
        <section className="np-right glass">
          <div className="seg-tabs" role="tablist">
            {([['lyrics', t.lyrics, Microphone], ['queue', t.queue, QueueIcon], ['similar', t.similar, Sparkle]] as const).map(([k, l, Icon]) => (
              <button key={k} role="tab" className="chip" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}><Icon size={14} style={{ verticalAlign: -2 }} /> {l}</button>
            ))}
          </div>
          <div className="panel-body">{tab === 'lyrics' ? <Lyrics big /> : tab === 'queue' ? <QueueList /> : <SimilarList />}</div>
        </section>
      </div>
    </>
  )
}
