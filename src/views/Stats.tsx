import { ChartBar, Sparkle } from '@phosphor-icons/react'
import { useState } from 'react'
import { Empty, SkeletonRows } from '../components/ui'
import { dnaFrom, dnaProfile, type Dna } from '../lib/ai'
import { api, type Count } from '../lib/api'
import { useT } from '../lib/i18n'
import { useLibrary } from '../store/library'
import { useStatus } from '../store/status'
import { ErrorState } from './common'
import { useAsync } from './hooks'

function TopList({ items, unit, label }: { items: Count[]; unit: string; label?: (k: string) => string }) {
  const max = Math.max(1, ...items.map((x) => x.plays))
  return (
    <div>
      {items.slice(0, 8).map((x, i) => (
        <div key={x.key + i} className="hbar">
          <span className="faint tabular">{i + 1}</span>
          <div className="lbl">{label ? label(x.key) : x.key}{x.sub && <small>{x.sub}</small>}</div>
          <span className="faint tabular" style={{ fontSize: 12 }}>{x.plays} {unit}</span>
          <div className="meter"><i style={{ width: `${(x.plays / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

/** Single-series bar chart with hover tooltips; one accent hue, no legend needed. */
function Bars({ values, labels, tip }: { values: number[]; labels: [string, string, string]; tip(i: number): string }) {
  const max = Math.max(1, ...values)
  return (
    <>
      <div className="bars" role="img" aria-label={values.map((v, i) => tip(i)).join(', ')}>
        {values.map((v, i) => <div key={i} className="b" data-tip={tip(i)}><i style={{ height: `${(v / max) * 100}%` }} /></div>)}
      </div>
      <div className="axis"><span>{labels[0]}</span><span>{labels[1]}</span><span>{labels[2]}</span></div>
    </>
  )
}

function Radar({ dna }: { dna: Dna }) {
  const t = useT()
  const n = dna.axes.length, R = 110, cx = 150, cy = 140
  const pt = (i: number, r: number) => [cx + r * Math.sin((i / n) * 2 * Math.PI), cy - r * Math.cos((i / n) * 2 * Math.PI)]
  const poly = dna.axes.map((a, i) => pt(i, R * Math.max(0.04, a.value)).join(',')).join(' ')
  return (
    <svg className="radar" viewBox="0 0 300 285" width="100%" style={{ maxWidth: 340 }} role="img" aria-label={dna.axes.map((a) => `${a.key} ${Math.round(a.value * 100)}%`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={dna.axes.map((_, i) => pt(i, R * k).join(',')).join(' ')} fill="none" stroke="var(--hair)" />)}
      {dna.axes.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--hair)" /> })}
      <polygon points={poly} fill="color-mix(in srgb, var(--accent) 30%, transparent)" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {dna.axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.04, a.value)); return <circle key={i} cx={x} cy={y} r={4} fill="var(--accent)" stroke="var(--base)" strokeWidth={2}><title>{`${t.axes[a.key as keyof typeof t.axes]}: ${Math.round(a.value * 100)}%`}</title></circle> })}
      {dna.axes.map((a, i) => { const [x, y] = pt(i, R + 18); return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{t.axes[a.key as keyof typeof t.axes]}</text> })}
    </svg>
  )
}

export function Stats() {
  const t = useT()
  const st = useStatus()
  const [days, setDays] = useState(30)
  const s = useAsync(() => api.stats(days), [days])
  useLibrary((x) => x.plays)
  const dna = dnaFrom(s.data ?? null)
  const [profile, setProfile] = useState<{ title: string; summary: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const today = Math.floor((Date.now() / 1000 - new Date().getTimezoneOffset() * 60) / 86400)
  const span = days > 0 ? Math.min(days, 60) : 60
  const perDay = Array.from({ length: span }, (_, i) => s.data?.by_day.find((d) => d[0] === today - span + 1 + i)?.[1] ?? 0)
  const dayLabel = (i: number) => new Date((today - span + 1 + i) * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="h-page">{t.stats}</h1>
        <div className="seg wide">{([[7, t.range7], [30, t.range30], [365, t.range365], [0, t.rangeAll]] as const).map(([d, l]) => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{l}</button>)}</div>
      </div>
      {s.loading && !s.data ? <SkeletonRows /> : s.error ? <ErrorState error={s.error} retry={s.retry} /> : !s.data?.plays ? <Empty icon={<ChartBar size={40} weight="duotone" />} text={t.noStats} /> : (
        <div className="bento">
          {([[t.listeningTime, Math.round(s.data.minutes), t.minutes], [t.tracksPlayed, s.data.tracks, ''], [t.artistsPlayed, s.data.artists, ''], [t.plays, s.data.plays, '']] as const).map(([l, v, u]) => (
            <section key={l} className="tile glass span-4" style={{ gridColumn: 'span 3', minHeight: 110 }}><div className="eyebrow">{l}</div><div className="kpi">{v.toLocaleString()}<small>{u}</small></div></section>
          ))}
          <section className="tile glass span-8"><b>{t.perDay}</b><Bars values={perDay} labels={[dayLabel(0), dayLabel(Math.floor(span / 2)), dayLabel(span - 1)]} tip={(i) => `${dayLabel(i)}: ${Math.round(perDay[i])} min`} /></section>
          <section className="tile glass span-4"><b>{t.perHour}</b><Bars values={s.data.by_hour} labels={['00', '12', '23']} tip={(i) => `${String(i).padStart(2, '0')}:00 — ${Math.round(s.data!.by_hour[i])} min`} /></section>
          <section className="tile glass span-6"><b>{t.topTracks}</b><TopList items={s.data.top_tracks} unit="×" /></section>
          <section className="tile glass span-6"><b>{t.topArtists}</b><TopList items={s.data.top_artists} unit="×" /></section>
          {s.data.top_genres.length > 0 && <section className="tile glass span-6"><b>{t.topGenres}</b><TopList items={s.data.top_genres} unit="×" /></section>}
          {s.data.top_moods.length > 0 && <section className="tile glass span-6"><b>{t.topMoods}</b><TopList items={s.data.top_moods} unit="×" label={(k) => t.moods[k as keyof typeof t.moods] ?? k} /></section>}
          <section className="tile glass span-12" style={{ flexDirection: 'row', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <Radar dna={dna} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="eyebrow">{t.dna}</div>
              <h2 className="h-hero" style={{ fontSize: 32, margin: '6px 0' }}>{profile?.title ?? t.dna}</h2>
              <p className="muted" style={{ maxWidth: '60ch', lineHeight: 1.6 }}>{profile?.summary ?? t.dnaHint}</p>
              <div className="row-gap" style={{ margin: '10px 0 14px' }}>{dna.genres.map((g) => <span key={g.key} className="pill">{g.key} {Math.round(g.share * 100)}%</span>)}</div>
              {st.ai && <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { setProfile(await dnaProfile(dna)) } catch { /* shown as unchanged */ } setBusy(false) }}><Sparkle size={16} weight="fill" />{t.describeMe}</button>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
