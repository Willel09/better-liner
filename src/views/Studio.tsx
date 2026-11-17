import { ChatCircleDots, Disc, MagicWand, Play, Playlist as PlaylistIcon, Sparkle } from '@phosphor-icons/react'
import { useState } from 'react'
import { TrackList } from '../components/TrackList'
import { SkeletonRows, toast } from '../components/ui'
import { analyzeTracks, assistant, buildPlaylist, djSession } from '../lib/ai'
import { api, errText } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { allTracks, resolve, useLibrary } from '../store/library'
import { current, playQueue, usePlayer } from '../store/player'
import { navigate } from '../store/router'
import { useSettings } from '../store/settings'
import { useStatus } from '../store/status'
import { ErrorState } from './common'
import { useDj } from './NowPlaying'

type Tab = 'builder' | 'dj' | 'assistant' | 'analysis'

function PromptBox({ value, onChange, onSubmit, placeholder, busy, label }: { value: string; onChange(v: string): void; onSubmit(): void; placeholder: string; busy: boolean; label: string }) {
  return (
    <form className="prompt-box glass" onSubmit={(e) => { e.preventDefault(); if (value.trim() && !busy) onSubmit() }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <button className="btn primary" disabled={busy || !value.trim()} type="submit">{busy ? <span className="spin-dot" /> : <Sparkle size={16} weight="fill" />}{label}</button>
    </form>
  )
}

function Builder() {
  const t = useT()
  const [p, setP] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const [res, setRes] = useState<{ id: string; name: string; description: string; tracks: Track[] } | null>(null)
  const run = async (prompt = p) => {
    setBusy(true); setErr(null)
    try { const r = await buildPlaylist(prompt); setRes({ id: r.playlist.id, name: r.playlist.name, description: r.description, tracks: r.tracks }) } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  return (
    <>
      <PromptBox value={p} onChange={setP} onSubmit={() => run()} placeholder={t.builderPrompt} busy={busy} label={busy ? t.generating : t.generate} />
      <div className="suggest">{t.builderExamples.map((x) => <button key={x} className="chip" onClick={() => { setP(x); run(x) }}>{x}</button>)}</div>
      {busy ? <SkeletonRows /> : err ? <ErrorState error={err} /> : res && (
        <section>
          <div className="page-head"><div><h2 className="h-page" style={{ fontSize: 26 }}>{res.name}</h2><p>{res.description}</p></div>
            <div className="toolbar"><button className="btn primary" onClick={() => playQueue(res.tracks)}><Play size={16} weight="fill" />{t.play}</button>
              <button className="btn glassy" onClick={() => navigate({ name: 'playlist', id: res.id })}><PlaylistIcon size={16} />{t.playlists}</button></div></div>
          <TrackList tracks={res.tracks} playlistId={res.id} />
        </section>
      )}
    </>
  )
}

function Dj() {
  const t = useT()
  const [vibe, setVibe] = useState('')
  const [useLib, setUseLib] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<unknown>(null)
  const [set, setSet] = useState<{ tracks: Track[]; intro: string } | null>(null)
  const run = async () => {
    setBusy(true); setErr(null)
    try {
      const s = useLibrary.get()
      const seed = useLib ? resolve([...new Set([...s.liked, ...s.history.slice(0, 60)])]).slice(0, 30) : []
      const r = await djSession(vibe, seed)
      setSet({ tracks: r.tracks, intro: r.intro })
      useDj.set({ intro: r.intro, segues: r.segues, baseIndex: 0 })
      playQueue(r.tracks)
      navigate({ name: 'now' })
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  return (
    <>
      <PromptBox value={vibe} onChange={setVibe} onSubmit={run} placeholder={t.djPrompt} busy={busy} label={t.startDj} />
      <label className="row-gap" style={{ margin: '12px 4px 24px' }}>
        <button className="switch" role="switch" aria-checked={useLib} onClick={() => setUseLib(!useLib)} aria-label={t.useLibrary} /> {t.useLibrary}
      </label>
      {busy ? <SkeletonRows /> : err ? <ErrorState error={err} /> : set && <><p className="muted">{set.intro}</p><TrackList tracks={set.tracks} /></>}
    </>
  )
}

function Assistant() {
  const t = useT()
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = async (text = q) => {
    const history = [...msgs, { role: 'user' as const, content: text }]
    setMsgs(history); setQ(''); setBusy(true)
    try {
      const stats = await api.stats(30).catch(() => null)
      const answer = await assistant(history, stats, current())
      setMsgs([...history, { role: 'assistant', content: answer }])
    } catch (e) { setMsgs([...history, { role: 'assistant', content: errText(e, useSettings.get().lang === 'sv') }]) } finally { setBusy(false) }
  }
  return (
    <>
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={'bubble ' + (m.role === 'user' ? 'me' : 'ai glass')}>{m.content}</div>)}
        {busy && <div className="bubble ai glass"><span className="ly-dots" style={{ padding: 0 }}><i /><i /><i /></span></div>}
      </div>
      {!msgs.length && <div className="suggest">{t.askExamples.map((x) => <button key={x} className="chip" onClick={() => ask(x)}>{x}</button>)}</div>}
      <PromptBox value={q} onChange={setQ} onSubmit={() => ask()} placeholder={t.askPlaceholder} busy={busy} label="" />
    </>
  )
}

function Analysis() {
  const t = useT()
  const feats = useLibrary((s) => s.features)
  const all = allTracks()
  const done = all.filter((x) => feats[x.id]?.mood).length
  const [prog, setProg] = useState<[number, number] | null>(null)
  const sv = useSettings((s) => s.lang) === 'sv'
  const moods = new Map<string, number>(), genres = new Map<string, number>()
  all.forEach((x) => { const f = feats[x.id]; if (f?.mood) moods.set(f.mood, (moods.get(f.mood) ?? 0) + 1); if (f?.genre) genres.set(f.genre, (genres.get(f.genre) ?? 0) + 1) })
  const bars = (m: Map<string, number>, label: (k: string) => string) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => (
    <div key={k} className="hbar"><span className="faint tabular">{n}</span><div className="lbl">{label(k)}</div><span /><div className="meter"><i style={{ width: `${(n / Math.max(1, done)) * 100}%` }} /></div></div>
  ))
  return (
    <div className="bento">
      <section className="tile glass span-12">
        <div className="page-head" style={{ margin: 0 }}>
          <div><b>{t.analyzeLibrary}</b><p style={{ fontSize: 12.5 }}>{t.analyzeHint}</p></div>
          <button className="btn primary" disabled={!!prog} onClick={async () => {
            setProg([0, 1])
            try { await analyzeTracks(all, (d, n) => setProg([d, n])); toast(t.analyzed) } catch (e) { toast(errText(e, sv)) } finally { setProg(null) }
          }}><MagicWand size={16} />{t.analyzeLibrary}</button>
        </div>
        <div className="kpi">{done}<small>/ {all.length} {t.analyzedCount}</small></div>
        {prog && <div className="progress-line"><i style={{ width: `${(prog[0] / prog[1]) * 100}%` }} /></div>}
      </section>
      <section className="tile glass span-6"><b>{t.topMoods}</b>{bars(moods, (k) => t.moods[k as keyof typeof t.moods] ?? k)}</section>
      <section className="tile glass span-6"><b>{t.topGenres}</b>{bars(genres, (k) => k)}</section>
    </div>
  )
}

export function Studio() {
  const t = useT()
  const st = useStatus()
  usePlayer((s) => s.index)
  const [tab, setTab] = useState<Tab>('builder')
  const tabs: [Tab, string, typeof Sparkle][] = [['builder', t.builder, PlaylistIcon], ['dj', t.dj, Disc], ['assistant', t.assistant, ChatCircleDots], ['analysis', t.analysis, MagicWand]]
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h-page">{t.studio}</h1>{st.ai && <p>{st.ai_model} · {new URL(st.ai_base || 'https://x').hostname}</p>}</div></div>
      <div className="studio-tabs glass" role="tablist">
        {tabs.map(([k, l, Icon]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}><Icon size={16} />{l}</button>)}
      </div>
      {!st.ai ? <ErrorState error="ai:nokey" /> : tab === 'builder' ? <Builder /> : tab === 'dj' ? <Dj /> : tab === 'assistant' ? <Assistant /> : <Analysis />}
    </div>
  )
}
