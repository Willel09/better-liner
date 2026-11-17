import { Disc, FolderPlus, Heart, MagicWand, MicrophoneStage, MusicNotesPlus, PencilSimple, Plus, Trash, UploadSimple, UserPlus, Check, X } from '@phosphor-icons/react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useMemo, useState } from 'react'
import { TrackList } from '../components/TrackList'
import { Card, Empty, Img, prompt, SkeletonRows, toast } from '../components/ui'
import { analyzeTracks } from '../lib/ai'
import { api, errText, isTauri } from '../lib/api'
import { useT } from '../lib/i18n'
import { parseTrackList } from '../lib/match'
import { localToTrack, primaryArtist, searchYt } from '../lib/tracks'
import type { SmartRule, Track } from '../lib/types'
import { allTracks, library, refTrack, resolve, smartTracks, useLibrary } from '../store/library'
import { playQueue } from '../store/player'
import { back, navigate } from '../store/router'
import { useSettings } from '../store/settings'
import { useStatus } from '../store/status'
import { CollectionHeader, ErrorState, PlayActions, totalMin } from './common'
import { useAsync } from './hooks'

function useAll() {
  const s = useLibrary()
  return useMemo(() => allTracks(), [s.tracks, s.saved, s.liked, s.local, s.playlists])
}

export async function addLocalFolder(sv: boolean) {
  if (!isTauri) return toast(errText('desktop-only', sv))
  const picked = await openDialog({ directory: true, multiple: true })
  if (!picked) return
  try {
    const ts = (await api.localScan(Array.isArray(picked) ? picked : [picked])).map(localToTrack)
    library.addLocal(ts)
    toast(`${ts.length} ${sv ? 'låtar' : 'songs'}`)
    analyzeTracks(ts).catch(() => {}) // BPM + loudness from the audio; AI mood/genre if a key is set
  } catch (e) { toast(errText(e, sv)) }
}

// ---------------- Library ----------------
export function LibraryView() {
  const t = useT()
  const sv = useSettings((s) => s.lang) === 'sv'
  const all = useAll()
  const { features, plays, saved } = useLibrary()
  const [sort, setSort] = useState<'added' | 'title' | 'artist' | 'plays' | 'bpm'>('added')
  const [mood, setMood] = useState('')
  const [text, setText] = useState('')
  const moods = useMemo(() => [...new Set(all.map((x) => features[x.id]?.mood).filter(Boolean))] as string[], [all, features])
  const list = useMemo(() => {
    let l = all.filter((x) => (!mood || features[x.id]?.mood === mood) && (!text || (x.title + ' ' + x.artist + ' ' + (x.album ?? '')).toLowerCase().includes(text.toLowerCase())))
    const by = { title: (a: Track, b: Track) => a.title.localeCompare(b.title), artist: (a: Track, b: Track) => a.artist.localeCompare(b.artist),
      plays: (a: Track, b: Track) => (plays[b.id] ?? 0) - (plays[a.id] ?? 0), bpm: (a: Track, b: Track) => (features[a.id]?.bpm ?? 999) - (features[b.id]?.bpm ?? 999),
      added: (a: Track, b: Track) => { const ia = saved.indexOf(a.id), ib = saved.indexOf(b.id); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) } }
    return [...l].sort(by[sort])
  }, [all, sort, mood, text, features, plays, saved])

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="h-page">{t.library}</h1><p>{all.length} {t.songs} · {totalMin(all)} min</p></div>
        <div className="toolbar">
          <button className="btn glassy" onClick={() => addLocalFolder(sv)}><FolderPlus size={16} />{t.addLocal}</button>
          <button className="btn glassy" onClick={() => navigate({ name: 'playlists' })}><UploadSimple size={16} />{t.importPlaylist}</button>
        </div>
      </div>
      {!all.length ? <Empty icon={<MusicNotesPlus size={40} weight="duotone" />} text={t.libraryEmpty}><button className="btn primary" onClick={() => navigate({ name: 'discover' })}>{t.discover}</button></Empty> : <>
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <label className="field" style={{ width: 240, height: 36 }}><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.filter} aria-label={t.filter} /></label>
          <div className="seg wide">{(['added', 'title', 'artist', 'plays', 'bpm'] as const).map((k) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{{ added: t.recentlyAdded, title: t.title, artist: t.artist, plays: t.plays, bpm: 'BPM' }[k]}</button>)}</div>
          {moods.length > 0 && <div className="row-gap">{moods.map((m) => <button key={m} className="chip" aria-pressed={mood === m} onClick={() => setMood(mood === m ? '' : m)}>{t.moods[m as keyof typeof t.moods] ?? m}</button>)}</div>}
        </div>
        <PlayActions tracks={list} />
        <TrackList tracks={list} />
      </>}
    </div>
  )
}

export function Liked() {
  const t = useT()
  const ids = useLibrary((s) => s.liked), all = useLibrary((s) => s.tracks)
  const tracks = useMemo(() => ids.map((x) => all[x]).filter(Boolean), [ids, all])
  return (
    <div className="page">
      <CollectionHeader kind={t.playlists} title={t.liked} sub={`${tracks.length} ${t.songs}`}
        art={<div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 25%, #140d24))' }}><Heart size={84} weight="fill" color="#fff" /></div>} />
      <PlayActions tracks={tracks} />
      {tracks.length ? <TrackList tracks={tracks} /> : <Empty icon={<Heart size={40} weight="duotone" />} text={t.emptyLiked} />}
    </div>
  )
}

// ---------------- Playlists (+ import, smart playlists) ----------------
function ImportBox({ onDone }: { onDone(): void }) {
  const t = useT()
  const sv = useSettings((s) => s.lang) === 'sv'
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    const v = text.trim()
    if (!v) return
    setBusy(true)
    try {
      let name: string, items: { title: string; artist: string; album?: string; duration?: number }[]
      if (/^https?:\/\/|^spotify:/.test(v) && !v.includes('\n')) { const r = await api.importPlaylist(v); name = r.name; items = r.tracks }
      else { name = (await prompt(t.importPlaylist, sv ? 'Importerad spellista' : 'Imported playlist', t.save, t.cancel)) ?? ''; if (!name) return; items = parseTrackList(v) }
      // Imported songs are references (title + artist). They're matched to YouTube when played — no quota spent up front.
      const tracks = items.filter((x) => x.title).map((x) => refTrack(x.title, x.artist, { album: x.album || undefined, duration: x.duration ?? 0 }))
      const pl = library.createPlaylist(name, [], {})
      library.addToPlaylist(pl.id, tracks)
      library.save(tracks)
      toast(`${t.imported}: ${tracks.length} ${t.songs}`)
      setText(''); onDone()
      navigate({ name: 'playlist', id: pl.id })
    } catch (e) { toast(errText(e, sv)) } finally { setBusy(false) }
  }
  return (
    <div className="tile glass" style={{ marginBottom: 24 }}>
      <b>{t.importPlaylist}</b>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{t.importHint}</p>
      <textarea className="field" style={{ height: 96, borderRadius: 16, padding: 12, resize: 'vertical', border: 0, outline: 'none' }} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'https://open.spotify.com/playlist/…\nhttps://www.deezer.com/playlist/…\nArtist - Title'} aria-label={t.importPlaylist} />
      <div className="row-gap"><button className="btn primary" disabled={busy || !text.trim()} onClick={run}><UploadSimple size={16} />{busy ? t.importing : t.importPlaylist}</button></div>
    </div>
  )
}

export function Playlists() {
  const t = useT()
  const { playlists, tracks, liked } = useLibrary()
  const [importing, setImporting] = useState(false)
  const folders = [...new Set(playlists.map((p) => p.folder ?? ''))].sort()
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="h-page">{t.playlists}</h1>
        <div className="toolbar">
          <button className="btn glassy" onClick={() => setImporting(!importing)}><UploadSimple size={16} />{t.importPlaylist}</button>
          <button className="btn glassy" onClick={async () => { const n = await prompt(t.smartPlaylist, t.smartPlaylist, t.create, t.cancel); if (n) navigate({ name: 'playlist', id: library.createPlaylist(n, [], { smart: [{ field: 'mood', op: 'is', value: 'chill' }] }).id }) }}><MagicWand size={16} />{t.smartPlaylist}</button>
          <button className="btn primary" onClick={async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n) navigate({ name: 'playlist', id: library.createPlaylist(n).id }) }}><Plus size={16} weight="bold" />{t.newPlaylist}</button>
        </div>
      </div>
      {importing && <ImportBox onDone={() => setImporting(false)} />}
      {folders.map((f) => (
        <section key={f || '_'}>
          {f && <h2 className="h-sec">{f}</h2>}
          <div className="grid">
            {!f && <Card title={t.liked} sub={`${liked.length} ${t.songs}`} art={tracks[liked[0]]?.artwork ?? null} onOpen={() => navigate({ name: 'liked' })} onPlay={() => playQueue(resolve(liked))} />}
            {playlists.filter((p) => (p.folder ?? '') === f).map((p) => (
              <Card key={p.id} title={p.name} sub={p.smart ? t.smartPlaylist : p.ai ? `AI · ${p.trackIds.length} ${t.songs}` : `${p.trackIds.length} ${t.songs}`}
                art={tracks[p.trackIds[0]]?.artwork ?? null} onOpen={() => navigate({ name: 'playlist', id: p.id })}
                onPlay={() => playQueue(p.smart ? smartTracks(p.smart) : resolve(p.trackIds))} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function RuleEditor({ rules, onChange }: { rules: SmartRule[]; onChange(r: SmartRule[]): void }) {
  const t = useT()
  const fields: SmartRule['field'][] = ['mood', 'genre', 'bpm', 'energy', 'artist', 'liked', 'plays']
  return (
    <div className="tile glass" style={{ marginBottom: 18, minHeight: 0 }}>
      <b>{t.rules}</b>
      {rules.map((r, i) => (
        <div key={i} className="row-gap">
          <select className="chip" value={r.field} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, field: e.target.value as SmartRule['field'] } : x)))} aria-label="field">{fields.map((f) => <option key={f}>{f}</option>)}</select>
          <select className="chip" value={r.op} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, op: e.target.value as SmartRule['op'] } : x)))} aria-label="operator">{['is', 'contains', 'gt', 'lt'].map((o) => <option key={o} value={o}>{{ is: '=', contains: '∋', gt: '>', lt: '<' }[o]}</option>)}</select>
          <label className="field" style={{ height: 32, width: 180 }}><input value={r.value} onChange={(e) => onChange(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label="value" /></label>
          <button className="icon-btn sm" aria-label={t.remove} onClick={() => onChange(rules.filter((_, j) => j !== i))}><X size={15} /></button>
        </div>
      ))}
      <div><button className="btn" onClick={() => onChange([...rules, { field: 'genre', op: 'contains', value: '' }])}><Plus size={14} />{t.addRule}</button></div>
    </div>
  )
}

export function PlaylistView({ id }: { id: string }) {
  const t = useT()
  const pl = useLibrary((s) => s.playlists.find((p) => p.id === id))
  const s = useLibrary()
  const tracks = useMemo(() => (pl ? (pl.smart ? smartTracks(pl.smart) : pl.trackIds.map((x) => s.tracks[x]).filter(Boolean)) : []), [pl, s.tracks, s.features, s.plays, s.liked])
  if (!pl) return <Empty icon={<MusicNotesPlus size={40} />} text="—" />
  return (
    <div className="page">
      <CollectionHeader title={pl.name} art={tracks[0]?.artwork ?? null} kind={pl.smart ? t.smartPlaylist : pl.ai ? 'AI' : t.playlists} sub={`${tracks.length} ${t.songs} · ${totalMin(tracks)} min`}>
        {pl.ai && <div className="faint" style={{ fontSize: 12.5 }}>“{pl.ai}”</div>}
      </CollectionHeader>
      <PlayActions tracks={tracks}>
        <button className="icon-btn" aria-label={t.rename} onClick={async () => { const n = await prompt(t.rename, pl.name, t.save, t.cancel); if (n) library.updatePlaylist(pl.id, { name: n }) }}><PencilSimple size={20} /></button>
        <button className="icon-btn" aria-label={t.analyze} onClick={() => analyzeTracks(tracks).then(() => toast(t.analyzed), (e) => toast(errText(e, useSettings.get().lang === 'sv')))}><MagicWand size={20} /></button>
        <button className="icon-btn" aria-label={t.delete} onClick={() => { library.deletePlaylist(pl.id); back() }}><Trash size={20} /></button>
      </PlayActions>
      {pl.smart && <RuleEditor rules={pl.smart} onChange={(smart) => library.updatePlaylist(pl.id, { smart })} />}
      {tracks.length ? <TrackList tracks={tracks} playlistId={pl.smart ? undefined : pl.id} onReorder={pl.smart ? undefined : (a, b) => library.moveInPlaylist(pl.id, a, b)} />
        : <Empty icon={<MusicNotesPlus size={40} weight="duotone" />} text={t.emptyPlaylist} />}
    </div>
  )
}

// ---------------- Artists ----------------
export function Artists() {
  const t = useT()
  const all = useAll()
  const followed = useLibrary((s) => s.followed)
  const artists = useMemo(() => {
    const m = new Map<string, Track[]>()
    all.forEach((x) => { const a = primaryArtist(x.artist); m.set(a, [...(m.get(a) ?? []), x]) })
    return [...m].sort((a, b) => Number(followed.includes(b[0])) - Number(followed.includes(a[0])) || b[1].length - a[1].length)
  }, [all, followed])
  return (
    <div className="page">
      <div className="page-head"><h1 className="h-page">{t.artists}</h1></div>
      {!artists.length ? <Empty icon={<MicrophoneStage size={40} weight="duotone" />} text={t.noArtists} /> : (
        <div className="grid">{artists.map(([name, ts]) => (
          <Card key={name} round title={name} sub={`${ts.length} ${t.songs}${followed.includes(name) ? ' · ' + t.following : ''}`} art={ts.find((x) => x.artwork)?.artwork ?? null}
            onOpen={() => navigate({ name: 'artist', name_: name })} onPlay={() => playQueue(ts)} />
        ))}</div>
      )}
    </div>
  )
}

export function ArtistView({ name }: { name: string }) {
  const t = useT()
  const all = useAll()
  const st = useStatus()
  const followed = useLibrary((s) => s.followed).includes(name)
  const mine = useMemo(() => all.filter((x) => primaryArtist(x.artist).toLowerCase() === name.toLowerCase()), [all, name])
  const yt = useAsync(() => searchYt(`${name} songs`, 20), [name], st.youtube)
  const popular = useMemo(() => (yt.data ?? []).filter((x) => x.artist.toLowerCase().includes(name.toLowerCase()) || x.title.toLowerCase().includes(name.toLowerCase())), [yt.data, name])
  const art = mine.find((x) => x.artwork)?.artwork ?? popular[0]?.artwork ?? null
  return (
    <div className="page">
      <header className="artist-hero">
        {art && <img className="bg" src={art} alt="" style={{ filter: 'blur(30px) saturate(140%)', transform: 'scale(1.2)' }} />}
        <div className="meta">
          <div className="avatar"><Img src={art} alt={name} /></div>
          <div><div className="eyebrow">{t.artist}</div><h1 className="h-hero">{name}</h1></div>
        </div>
      </header>
      <PlayActions tracks={[...mine, ...popular]}>
        <button className="btn glassy" aria-pressed={followed} onClick={() => library.follow(name)}>{followed ? <Check size={16} weight="bold" /> : <UserPlus size={16} />}{followed ? t.following : t.follow}</button>
      </PlayActions>
      {mine.length > 0 && <><h2 className="h-sec">{t.inLibrary}</h2><TrackList tracks={mine} /></>}
      {st.youtube && <><h2 className="h-sec">{t.popularOnYt}</h2>
        {yt.loading ? <SkeletonRows n={6} /> : yt.error ? <ErrorState error={yt.error} retry={yt.retry} /> : <TrackList tracks={popular.length ? popular : yt.data ?? []} showFeatures={false} />}</>}
    </div>
  )
}

// ---------------- Albums ----------------
const albumKey = (x: Track) => primaryArtist(x.artist) + '|' + x.album
export function Albums() {
  const t = useT()
  const all = useAll()
  const albums = useMemo(() => {
    const m = new Map<string, Track[]>()
    all.filter((x) => x.album).forEach((x) => m.set(albumKey(x), [...(m.get(albumKey(x)) ?? []), x]))
    return [...m].sort((a, b) => a[0].localeCompare(b[0]))
  }, [all])
  return (
    <div className="page">
      <div className="page-head"><h1 className="h-page">{t.albums}</h1></div>
      {!albums.length ? <Empty icon={<Disc size={40} weight="duotone" />} text={t.noAlbums} /> : (
        <div className="grid">{albums.map(([k, ts]) => (
          <Card key={k} title={ts[0].album!} sub={primaryArtist(ts[0].artist)} art={ts.find((x) => x.artwork)?.artwork ?? null} onOpen={() => navigate({ name: 'album', key: k })} onPlay={() => playQueue(ts)} />
        ))}</div>
      )}
    </div>
  )
}

export function AlbumView({ k }: { k: string }) {
  const t = useT()
  const all = useAll()
  const tracks = useMemo(() => all.filter((x) => x.album && albumKey(x) === k), [all, k])
  if (!tracks.length) return <Empty icon={<Disc size={40} />} text={t.noAlbums} />
  return (
    <div className="page">
      <CollectionHeader kind={t.albums} title={tracks[0].album!} art={tracks.find((x) => x.artwork)?.artwork ?? null} sub={`${primaryArtist(tracks[0].artist)} · ${tracks.length} ${t.songs} · ${totalMin(tracks)} min`} />
      <PlayActions tracks={tracks} />
      <TrackList tracks={tracks} />
    </div>
  )
}

export { SkeletonRows }
