import { ArrowCounterClockwise, BookmarkSimple, CloudArrowDown, Clock, FolderPlus, Heart, MagnifyingGlass, MusicNotesPlus, PencilSimple, Play, Shuffle, Trash, UserPlus, Check, FileAudio, WifiSlash } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { downloadTrack } from '../components/TrackMenu'
import { TrackList } from '../components/TrackList'
import { Card, Empty, Img, prompt, SkeletonGrid, SkeletonRows, toast } from '../components/ui'
import { audius, GENRES } from '../lib/audius'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { library, resolve, useLibrary } from '../store/library'
import { playQueue, toggleShuffle, usePlayer } from '../store/player'
import { back, navigate } from '../store/router'
import { useAsync } from './hooks'

function ErrorState({ retry }: { retry(): void }) {
  const t = useT()
  return <Empty icon={<WifiSlash size={40} weight="duotone" />} text={t.error}><button className="btn" onClick={retry}><ArrowCounterClockwise size={16} />{t.retry}</button></Empty>
}

function PlayActions({ tracks, children }: { tracks: Track[]; children?: ReactNode }) {
  const t = useT()
  return (
    <div className="actions">
      <button className="play-fab" aria-label={t.play} disabled={!tracks.length} onClick={() => { if (usePlayer.get().shuffle) toggleShuffle(); playQueue(tracks) }}><Play size={22} weight="fill" /></button>
      <button className="btn glassy" disabled={!tracks.length} onClick={() => { if (!usePlayer.get().shuffle) toggleShuffle(); playQueue(tracks, Math.floor(Math.random() * tracks.length)) }}><Shuffle size={16} weight="bold" />{t.shuffle}</button>
      {children}
    </div>
  )
}

// ---------------- Home ----------------
export function Home() {
  const t = useT()
  const [genre, setGenre] = useState<string>('')
  const trending = useAsync(() => audius.trending(genre || undefined), [genre])
  const lists = useAsync(() => audius.trendingPlaylists(), [])
  const history = useLibrary((s) => s.history)
  const recent = useMemo(() => resolve(history.slice(0, 12)), [history])
  const top = trending.data?.[0]
  const hour = new Date().getHours()
  const greet = hour < 11 ? t.morning : hour < 18 ? t.afternoon : t.evening

  return (
    <div className="page">
      {top ? (
        <section className="feature">
          <img className="bg" src={top.artwork ?? ''} alt="" />
          <div>
            <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>{greet} · {t.trending}</div>
            <h1 className="h-hero" style={{ marginTop: 8 }}>{top.title}</h1>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>{top.artist}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" onClick={() => playQueue(trending.data!, 0)}><Play size={16} weight="fill" />{t.play}</button>
          </div>
        </section>
      ) : <div className="skel" style={{ height: 300, borderRadius: 28 }} />}

      {recent.length > 0 && <>
        <h2 className="h-sec">{t.recent}</h2>
        <div className="shelf">{recent.map((tr, i) => (
          <Card key={tr.id} title={tr.title} sub={tr.artist} art={tr.artwork} onOpen={() => playQueue(recent, i)} onPlay={() => playQueue(recent, i)} />
        ))}</div>
      </>}

      <h2 className="h-sec">{t.trending}</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="chip" aria-pressed={!genre} onClick={() => setGenre('')}>{t.all}</button>
        {GENRES.map((g) => <button key={g} className="chip" aria-pressed={genre === g} onClick={() => setGenre(g)}>{g}</button>)}
      </div>
      {trending.loading ? <SkeletonRows /> : trending.error ? <ErrorState retry={trending.retry} /> : <TrackList tracks={trending.data!.slice(0, 20)} />}

      <h2 className="h-sec">{t.trendingPlaylists}</h2>
      {lists.loading ? <SkeletonGrid /> : lists.error ? <ErrorState retry={lists.retry} /> : (
        <div className="shelf">{lists.data!.map((p) => (
          <Card key={p.id} title={p.name} sub={p.artist} art={p.artwork} onOpen={() => navigate({ name: 'album', id: p.id })}
            onPlay={async () => playQueue(await audius.albumTracks(p.id))} />
        ))}</div>
      )}
    </div>
  )
}

// ---------------- Search ----------------
export function Search({ q: initial = '' }: { q?: string }) {
  const t = useT()
  const [q, setQ] = useState(initial)
  const [debounced, setDebounced] = useState(initial)
  const [tab, setTab] = useState<'all' | 'tracks' | 'artists' | 'albums'>('all')
  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 280); return () => clearTimeout(id) }, [q])
  const res = useAsync(async () => {
    if (!debounced) return null
    const [tracks, artists, albums] = await Promise.all([audius.searchTracks(debounced), audius.searchArtists(debounced), audius.searchAlbums(debounced)])
    // Include matching local files too.
    const lib = useLibrary.get()
    const ql = debounced.toLowerCase()
    const local = resolve(lib.local).filter((x) => (x.title + ' ' + x.artist + ' ' + (x.album ?? '')).toLowerCase().includes(ql))
    return { tracks: [...local, ...tracks], artists, albums }
  }, [debounced])
  const genres = useMemo(() => GENRES, [])

  return (
    <div className="page">
      <label className="field" style={{ height: 48, maxWidth: 560, marginBottom: 22 }}>
        <MagnifyingGlass size={18} className="faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} />
      </label>
      {!debounced ? <>
        <h2 className="h-sec" style={{ marginTop: 8 }}>{t.genres}</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {genres.map((g, i) => (
            <button key={g} className="card glass" onClick={() => setQ(g)} style={{ height: 96, padding: 18, justifyContent: 'flex-end', borderRadius: 20, background: `linear-gradient(135deg, hsl(${(i * 37) % 360} 45% 38% / .55), hsl(${(i * 37 + 40) % 360} 45% 22% / .35))` }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{g}</span>
            </button>
          ))}
        </div>
      </> : <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['all', 'tracks', 'artists', 'albums'] as const).map((k) => (
            <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{k === 'all' ? t.all : t[k]}</button>
          ))}
        </div>
        {res.loading ? <SkeletonRows /> : res.error ? <ErrorState retry={res.retry} /> : !res.data || (!res.data.tracks.length && !res.data.artists.length && !res.data.albums.length)
          ? <Empty icon={<MagnifyingGlass size={40} weight="duotone" />} text={`${t.noResults} “${debounced}”`} />
          : <>
            {(tab === 'all' || tab === 'tracks') && res.data.tracks.length > 0 && <>
              {tab === 'all' && <h2 className="h-sec" style={{ marginTop: 0 }}>{t.tracks}</h2>}
              <TrackList tracks={tab === 'all' ? res.data.tracks.slice(0, 6) : res.data.tracks} />
            </>}
            {(tab === 'all' || tab === 'artists') && res.data.artists.length > 0 && <>
              <h2 className="h-sec">{t.artists}</h2>
              <div className={tab === 'all' ? 'shelf' : 'grid'}>{res.data.artists.slice(0, tab === 'all' ? 10 : 40).map((a) => (
                <Card key={a.id} round title={a.name} sub={`${a.followers.toLocaleString()} ${t.followers}`} art={a.avatar} onOpen={() => navigate({ name: 'artist', id: a.id })} />
              ))}</div>
            </>}
            {(tab === 'all' || tab === 'albums') && res.data.albums.length > 0 && <>
              <h2 className="h-sec">{t.albums}</h2>
              <div className={tab === 'all' ? 'shelf' : 'grid'}>{res.data.albums.slice(0, tab === 'all' ? 10 : 40).map((p) => (
                <Card key={p.id} title={p.name} sub={p.artist} art={p.artwork} onOpen={() => navigate({ name: 'album', id: p.id })}
                  onPlay={async () => playQueue(await audius.albumTracks(p.id))} />
              ))}</div>
            </>}
          </>}
      </>}
    </div>
  )
}

// ---------------- Artist ----------------
export function ArtistView({ id }: { id: string }) {
  const t = useT()
  const followed = useLibrary((s) => s.followed)
  const a = useAsync(() => Promise.all([audius.artist(id), audius.artistTracks(id)]), [id])
  if (a.loading) return <div className="page"><div className="skel" style={{ height: 280, marginBottom: 20 }} /><SkeletonRows /></div>
  if (a.error) return <ErrorState retry={a.retry} />
  const [artist, tracks] = a.data!
  const isFollowed = followed.some((f) => f.id === artist.id)
  return (
    <div className="page">
      <header className="artist-hero">
        {artist.cover && <img className="bg" src={artist.cover} alt="" />}
        <div className="meta">
          <div className="avatar"><Img src={artist.avatar} alt={artist.name} /></div>
          <div>
            <h1 className="h-hero">{artist.name}</h1>
            <div className="muted" style={{ marginTop: 6 }}>{artist.followers.toLocaleString()} {t.followers}</div>
          </div>
        </div>
      </header>
      <PlayActions tracks={tracks}>
        <button className="btn glassy" aria-pressed={isFollowed} onClick={() => library.toggleFollow({ id: artist.id, name: artist.name, avatar: artist.avatar })}>
          {isFollowed ? <Check size={16} weight="bold" /> : <UserPlus size={16} />}{isFollowed ? t.following : t.follow}
        </button>
      </PlayActions>
      <h2 className="h-sec">{t.popular}</h2>
      <TrackList tracks={tracks} />
      {artist.bio && <p className="muted" style={{ maxWidth: '65ch', marginTop: 32, lineHeight: 1.6, userSelect: 'text' }}>{artist.bio}</p>}
    </div>
  )
}

// ---------------- Collection header (album / playlist / built-ins) ----------------
function CollectionHeader({ title, sub, art, kind }: { title: string; sub: string; art: string | null; kind: string }) {
  return (
    <header className="hero">
      <div className="cover"><Img src={art} alt={title} /></div>
      <div className="meta">
        <div className="eyebrow">{kind}</div>
        <h1 className="h-hero">{title}</h1>
        <div className="muted">{sub}</div>
      </div>
    </header>
  )
}

const totalMin = (ts: Track[]) => Math.round(ts.reduce((a, x) => a + x.duration, 0) / 60)

export function AlbumView({ id }: { id: string }) {
  const t = useT()
  const saved = useLibrary((s) => s.savedAlbums)
  const a = useAsync(() => Promise.all([audius.album(id), audius.albumTracks(id)]), [id])
  if (a.loading) return <div className="page"><div className="skel" style={{ height: 224, width: 224, marginBottom: 20 }} /><SkeletonRows /></div>
  if (a.error) return <ErrorState retry={a.retry} />
  const [album, tracks] = a.data!
  const isSaved = saved.some((s) => s.id === album.id)
  return (
    <div className="page">
      <CollectionHeader title={album.name} art={album.artwork} kind={t.albums} sub={`${album.artist} · ${tracks.length} ${t.songs} · ${totalMin(tracks)} min`} />
      <PlayActions tracks={tracks}>
        <button className="icon-btn" aria-pressed={isSaved} aria-label="Save" onClick={() => library.toggleAlbum({ id: album.id, name: album.name, artist: album.artist, artwork: album.artwork })}>
          <BookmarkSimple size={22} weight={isSaved ? 'fill' : 'regular'} />
        </button>
        <button className="icon-btn" aria-label={t.download} onClick={async () => { for (const tr of tracks) await downloadTrack(tr, t) }}><CloudArrowDown size={22} /></button>
      </PlayActions>
      <TrackList tracks={tracks} showAlbum={false} />
    </div>
  )
}

export function PlaylistView({ id }: { id: string }) {
  const t = useT()
  const pl = useLibrary((s) => s.playlists.find((p) => p.id === id))
  const all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => (pl ? pl.trackIds.map((x) => all[x]).filter(Boolean) : []), [pl, all])
  if (!pl) return <Empty icon={<MusicNotesPlus size={40} />} text="—" />
  return (
    <div className="page">
      <CollectionHeader title={pl.name} art={tracks[0]?.artwork ?? null} kind={t.playlists} sub={`${tracks.length} ${t.songs} · ${totalMin(tracks)} min`} />
      <PlayActions tracks={tracks}>
        <button className="icon-btn" aria-label={t.rename} onClick={async () => { const n = await prompt(t.rename, pl.name, t.save, t.cancel); if (n) library.renamePlaylist(pl.id, n) }}><PencilSimple size={20} /></button>
        <button className="icon-btn" aria-label={t.download} onClick={async () => { for (const tr of tracks) if (tr.source === 'audius') await downloadTrack(tr, t) }}><CloudArrowDown size={20} /></button>
        <button className="icon-btn" aria-label={t.delete} onClick={() => { library.deletePlaylist(pl.id); back() }}><Trash size={20} /></button>
      </PlayActions>
      {tracks.length ? <TrackList tracks={tracks} playlistId={pl.id} onReorder={(a, b) => library.moveInPlaylist(pl.id, a, b)} />
        : <Empty icon={<MusicNotesPlus size={40} weight="duotone" />} text={t.emptyPlaylist}><button className="btn" onClick={() => navigate({ name: 'search' })}>{t.search}</button></Empty>}
    </div>
  )
}

export function Liked() {
  const t = useT()
  const ids = useLibrary((s) => s.liked), all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => ids.map((x) => all[x]).filter(Boolean), [ids, all])
  return (
    <div className="page">
      <header className="hero">
        <div className="cover" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 30%, #1b1030))' }}><Heart size={84} weight="fill" color="#fff" /></div>
        <div className="meta"><div className="eyebrow">{t.playlists}</div><h1 className="h-hero">{t.liked}</h1><div className="muted">{tracks.length} {t.songs}</div></div>
      </header>
      <PlayActions tracks={tracks} />
      {tracks.length ? <TrackList tracks={tracks} /> : <Empty icon={<Heart size={40} weight="duotone" />} text={t.emptyLiked} />}
    </div>
  )
}

export function LocalFiles() {
  const t = useT()
  const ids = useLibrary((s) => s.local), all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => ids.map((x) => all[x]).filter(Boolean), [ids, all])
  const [busy, setBusy] = useState(false)
  const pick = async (kind: 'folder' | 'files') => {
    if (!window.lumen) return
    setBusy(true)
    try { const ts = await window.lumen.pickLocal(kind); library.addLocal(ts); if (ts.length) toast(`${ts.length} ${t.songs}`) } catch { toast(t.error) } finally { setBusy(false) }
  }
  return (
    <div className="page">
      <h1 className="h-page" style={{ marginBottom: 6 }}>{t.local}</h1>
      <PlayActions tracks={tracks}>
        <button className="btn glassy" disabled={busy} onClick={() => pick('folder')}><FolderPlus size={16} />{t.importFolder}</button>
        <button className="btn glassy" disabled={busy} onClick={() => pick('files')}><FileAudio size={16} />{t.importFiles}</button>
      </PlayActions>
      {busy ? <SkeletonRows /> : tracks.length ? <TrackList tracks={tracks} /> : <Empty icon={<FolderPlus size={40} weight="duotone" />} text={t.emptyLocal} />}
    </div>
  )
}

export function Downloads() {
  const t = useT()
  const d = useLibrary((s) => s.downloads), all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => Object.keys(d).map((x) => all[x]).filter(Boolean), [d, all])
  return (
    <div className="page">
      <h1 className="h-page" style={{ marginBottom: 6 }}>{t.downloads}</h1>
      <PlayActions tracks={tracks} />
      {tracks.length ? <TrackList tracks={tracks} /> : <Empty icon={<CloudArrowDown size={40} weight="duotone" />} text={t.emptyDownloads} />}
    </div>
  )
}

export function History() {
  const t = useT()
  const ids = useLibrary((s) => s.history), all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => ids.map((x) => all[x]).filter(Boolean), [ids, all])
  return (
    <div className="page">
      <h1 className="h-page" style={{ marginBottom: 6 }}>{t.history}</h1>
      <PlayActions tracks={tracks} />
      {tracks.length ? <TrackList tracks={tracks} /> : <Empty icon={<Clock size={40} weight="duotone" />} text={t.emptyHistory} />}
    </div>
  )
}

export function LibraryView() {
  const t = useT()
  const { playlists, savedAlbums, followed, liked, tracks: all } = useLibrary()
  const [filter, setFilter] = useState<'all' | 'playlists' | 'albums' | 'artists'>('all')
  const show = (k: typeof filter) => filter === 'all' || filter === k
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 className="h-page">{t.library}</h1>
        <button className="btn primary" onClick={async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n) navigate({ name: 'playlist', id: library.createPlaylist(n).id }) }}>
          <MusicNotesPlus size={16} />{t.newPlaylist}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {(['all', 'playlists', 'albums', 'artists'] as const).map((k) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === 'all' ? t.all : t[k]}</button>)}
      </div>
      <div className="grid">
        {show('playlists') && <Card title={t.liked} sub={`${liked.length} ${t.songs}`} art={all[liked[0]]?.artwork ?? null} onOpen={() => navigate({ name: 'liked' })} onPlay={() => playQueue(resolve(liked))} />}
        {show('playlists') && playlists.map((p) => (
          <Card key={p.id} title={p.name} sub={`${p.trackIds.length} ${t.songs}`} art={all[p.trackIds[0]]?.artwork ?? null}
            onOpen={() => navigate({ name: 'playlist', id: p.id })} onPlay={() => playQueue(resolve(p.trackIds))} />
        ))}
        {show('albums') && savedAlbums.map((a) => (
          <Card key={a.id} title={a.name} sub={a.artist} art={a.artwork} onOpen={() => navigate({ name: 'album', id: a.id })} onPlay={async () => playQueue(await audius.albumTracks(a.id))} />
        ))}
        {show('artists') && followed.map((a) => <Card key={a.id} round title={a.name} sub={t.artists} art={a.avatar} onOpen={() => navigate({ name: 'artist', id: a.id })} />)}
      </div>
    </div>
  )
}
