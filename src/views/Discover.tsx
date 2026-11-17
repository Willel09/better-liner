import { ArrowsClockwise, MagnifyingGlass, Sparkle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { TrackList } from '../components/TrackList'
import { Empty, SkeletonRows } from '../components/ui'
import { discover, similarTo } from '../lib/ai'
import { api, isTauri, ytmSearchUrl } from '../lib/api'
import { useT } from '../lib/i18n'
import { searchYt } from '../lib/tracks'
import { allTracks, useLibrary } from '../store/library'
import { useStatus } from '../store/status'
import { ErrorState, PlayActions } from './common'
import { useAsync } from './hooks'

const GENRES = ['Pop', 'Hip-hop', 'Indie', 'Electronic', 'R&B', 'Rock', 'Jazz', 'Lo-fi', 'Afrobeats', 'K-pop', 'Latin', 'Klassiskt']

export function Discover({ q: initial = '' }: { q?: string }) {
  const t = useT()
  const st = useStatus()
  const [q, setQ] = useState(initial)
  const [query, setQuery] = useState(initial)
  const [nonce, setNonce] = useState(0)
  const results = useAsync(() => searchYt(query, 20), [query], !!query && st.youtube)
  const disc = useAsync(async () => discover(await api.stats(30).catch(() => null)), [nonce], st.ai)
  const why = useMemo(() => Object.fromEntries((disc.data?.picks ?? []).map((p) => [p.id, p.why ?? ''])), [disc.data])

  return (
    <div className="page">
      <div className="page-head"><h1 className="h-page">{t.discover}</h1></div>
      <form className="field" style={{ height: 50, maxWidth: 620, marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); if (!st.youtube && isTauri && q.trim()) api.ytmOpen(ytmSearchUrl(q.trim())); else setQuery(q.trim()) }}>
        <MagnifyingGlass size={18} className="faint" />
        <input autoFocus={!!initial || undefined} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} />
        <span className="faint" style={{ fontSize: 12 }}>{st.youtube ? t.searchHint : t.ytmSearchHint}</span>
      </form>
      <div className="row-gap" style={{ marginBottom: 24 }}>
        {GENRES.map((g) => <button key={g} className="chip" aria-pressed={query === `${g} hits`} onClick={() => { setQ(`${g} hits`); if (!st.youtube && isTauri) api.ytmOpen(ytmSearchUrl(`${g} hits`)); else setQuery(`${g} hits`) }}>{g}</button>)}
      </div>

      {query && st.youtube && (
        <section>
          <h2 className="h-sec" style={{ marginTop: 0 }}>{t.search}: “{query}”</h2>
          {results.loading ? <SkeletonRows /> : results.error ? <ErrorState error={results.error} retry={results.retry} />
            : !results.data?.length ? <Empty icon={<MagnifyingGlass size={40} weight="duotone" />} text={`${t.noResults} “${query}”`} />
            : <TrackList tracks={results.data} showFeatures={false} />}
        </section>
      )}

      <section>
        <h2 className="h-sec">
          <span><Sparkle size={18} weight="fill" style={{ color: 'var(--accent)', verticalAlign: -2 }} /> {disc.data?.theme || t.discoverTitle}</span>
          {st.ai && <button className="btn" onClick={() => setNonce((n) => n + 1)} disabled={disc.loading}><ArrowsClockwise size={15} />{t.refresh}</button>}
        </h2>
        {!st.ai ? <ErrorState error="ai:nokey" />
          : disc.loading ? <SkeletonRows n={6} /> : disc.error ? <ErrorState error={disc.error} retry={disc.retry} />
          : <><PlayActions tracks={disc.data!.picks} /><TrackList tracks={disc.data!.picks} why={why} /></>}
      </section>

      {disc.data && disc.data.rediscover.length > 0 && <section>
        <h2 className="h-sec">{t.rediscover}</h2>
        <TrackList tracks={disc.data.rediscover} />
      </section>}
    </div>
  )
}

export function Similar({ id }: { id: string }) {
  const t = useT()
  const seed = useLibrary((s) => s.tracks[id])
  const res = useAsync(() => similarTo(seed, 20), [id], !!seed)
  const why = useMemo(() => Object.fromEntries((res.data ?? []).map((p) => [p.id, p.why ?? ''])), [res.data])
  if (!seed) return <Empty icon={<Sparkle size={40} />} text="—" />
  return (
    <div className="page">
      <div className="page-head"><div><div className="eyebrow">{t.similar}</div><h1 className="h-page">{seed.title}</h1><p>{seed.artist}</p></div></div>
      {res.loading ? <SkeletonRows /> : res.error ? <ErrorState error={res.error} retry={res.retry} /> : <>
        <PlayActions tracks={[seed, ...res.data!]} />
        <TrackList tracks={res.data!} why={why} />
      </>}
    </div>
  )
}

export const libraryCount = () => allTracks().length
