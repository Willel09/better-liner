import { ClockCounterClockwise, Play } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { Card, Img } from '../components/ui'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import { smartShuffle } from '../lib/shuffle'
import type { Track } from '../lib/types'
import { allTracks, resolve, useLibrary } from '../store/library'
import { playQueue } from '../store/player'
import { navigate } from '../store/router'
import { ConnectCards } from './common'
import { useAsync } from './hooks'

export type Mix = { id: string; name: string; sub: string; tracks: Track[] }

/** "Made for you" mixes built locally from the library: per mood, per top artist cluster, and a daily mix. */
export function useMixes(): Mix[] {
  const t = useT()
  const s = useLibrary()
  return useMemo(() => {
    const lib = allTracks()
    if (lib.length < 4) return []
    const out: Mix[] = []
    const day = new Date().toDateString()
    let seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0)
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const fav = [...lib].sort((a, b) => (s.plays[b.id] ?? 0) - (s.plays[a.id] ?? 0) + (s.liked.includes(b.id) ? 2 : 0) - (s.liked.includes(a.id) ? 2 : 0))
    out.push({ id: 'daily', name: 'Daily Mix', sub: [...new Set(fav.slice(0, 12).map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(fav.slice(0, 50), { rand, features: s.features }) })
    const byMood = new Map<string, Track[]>()
    lib.forEach((x) => { const m = s.features[x.id]?.mood; if (m) byMood.set(m, [...(byMood.get(m) ?? []), x]) })
    ;[...byMood].filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length).slice(0, 4).forEach(([mood, v]) => {
      const label = t.moods[mood as keyof typeof t.moods] ?? mood
      out.push({ id: 'mood:' + mood, name: label[0].toUpperCase() + label.slice(1) + ' mix', sub: [...new Set(v.map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(v, { rand, features: s.features, mode: 'tempo' }) })
    })
    const old = lib.filter((x) => (s.plays[x.id] ?? 0) <= 1)
    if (old.length >= 6) out.push({ id: 'rediscover', name: t.rediscover, sub: [...new Set(old.map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(old, { rand }).slice(0, 40) })
    return out
  }, [s.tracks, s.features, s.plays, s.liked, t])
}

export function MixCard({ mix }: { mix: Mix }) {
  const arts = [...new Set(mix.tracks.map((x) => x.artwork).filter(Boolean))].slice(0, 4) as string[]
  return (
    <button className="mix" onClick={() => playQueue(mix.tracks)} aria-label={mix.name}>
      <div className="grid4">{[0, 1, 2, 3].map((i) => arts[i % Math.max(1, arts.length)] ? <img key={i} src={arts[i % arts.length]} alt="" /> : <div key={i} style={{ background: 'var(--fill-press)' }} />)}</div>
      <div><b>{mix.name}</b><span>{mix.sub}</span></div>
    </button>
  )
}

export function Home() {
  const t = useT()
  const history = useLibrary((s) => s.history)
  const playlists = useLibrary((s) => s.playlists)
  const tracks = useLibrary((s) => s.tracks)
  const recent = useMemo(() => resolve(history.slice(0, 14)), [history])
  const mixes = useMixes()
  const week = useAsync(() => api.stats(7), [])
  const hour = new Date().getHours()
  const greet = hour < 11 ? t.morning : hour < 18 ? t.afternoon : t.evening
  const last = recent[0]

  return (
    <div className="page">
      <div className="page-head"><h1 className="h-page" style={{ fontSize: 34 }}>{greet}</h1></div>
      <ConnectCards />
      <div className="bento">
        <section className="tile glass span-8" style={{ minHeight: 230, padding: 0 }}>
          {last ? <>
            {last.artwork && <img src={last.artwork} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(36px) saturate(150%)', opacity: 0.55, transform: 'scale(1.2)' }} />}
            <div style={{ position: 'relative', display: 'flex', gap: 22, padding: 22, alignItems: 'center', height: '100%' }}>
              <div className="cover" style={{ width: 180, flex: 'none' }}><Img src={last.artwork} alt={last.title} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="eyebrow"><ClockCounterClockwise size={13} style={{ verticalAlign: -2 }} /> {t.recent}</div>
                <h2 className="h-hero" style={{ fontSize: 'clamp(26px, 3vw, 40px)', margin: '8px 0 4px' }}>{last.title}</h2>
                <div className="muted" style={{ fontSize: 15 }}>{last.artist}</div>
                <button className="btn primary" style={{ marginTop: 16 }} onClick={() => playQueue(recent, 0)}><Play size={16} weight="fill" />{t.play}</button>
              </div>
            </div>
          </> : <div style={{ padding: 22 }}><div className="eyebrow">{t.recent}</div><p className="muted">{t.libraryEmpty}</p><button className="btn primary" onClick={() => navigate({ name: 'discover' })}>{t.discover}</button></div>}
        </section>
        <section className="tile glass span-4" aria-label={t.thisWeek}>
          <div className="eyebrow">{t.thisWeek}</div>
          <div className="kpi">{Math.round(week.data?.minutes ?? 0)}<small>{t.minutes} {t.listened}</small></div>
          <div className="bars" style={{ height: 70 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = Math.floor((Date.now() / 1000 - new Date().getTimezoneOffset() * 60) / 86400) - 6 + i
              const m = week.data?.by_day.find((d) => d[0] === day)?.[1] ?? 0
              const max = Math.max(1, ...(week.data?.by_day.map((d) => d[1]) ?? [1]))
              return <div key={i} className="b" data-tip={`${Math.round(m)} min`}><i style={{ height: `${(m / max) * 100}%` }} /></div>
            })}
          </div>
          {week.data?.top_artists[0] && <div className="muted" style={{ fontSize: 12.5 }}>{t.topArtist}: <b style={{ color: 'var(--text)' }}>{week.data.top_artists[0].key}</b></div>}
        </section>
      </div>

      {mixes.length > 0 && <>
        <h2 className="h-sec">{t.madeForYou}</h2>
        <div className="shelf">{mixes.map((m) => <MixCard key={m.id} mix={m} />)}</div>
      </>}

      {recent.length > 1 && <>
        <h2 className="h-sec">{t.recent}</h2>
        <div className="shelf">{recent.map((tr, i) => <Card key={tr.id} title={tr.title} sub={tr.artist} art={tr.artwork} onOpen={() => playQueue(recent, i)} onPlay={() => playQueue(recent, i)} />)}</div>
      </>}

      {playlists.length > 0 && <>
        <h2 className="h-sec">{t.yourPlaylists}</h2>
        <div className="shelf">{playlists.slice(-12).reverse().map((p) => (
          <Card key={p.id} title={p.name} sub={`${p.trackIds.length} ${t.songs}`} art={tracks[p.trackIds[0]]?.artwork ?? null}
            onOpen={() => navigate({ name: 'playlist', id: p.id })} onPlay={() => playQueue(resolve(p.trackIds))} />
        ))}</div>
      </>}
    </div>
  )
}
