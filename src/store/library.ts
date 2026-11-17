import type { Features, Playlist, SmartRule, Track } from '../lib/types'
import { create } from './create'

// Library = metadata only (a few hundred KB even for big collections). Audio is always streamed.
export const useLibrary = create({
  tracks: {} as Record<string, Track>,
  saved: [] as string[], // "added to library" (incl. imports)
  liked: [] as string[],
  local: [] as string[],
  history: [] as string[],
  playlists: [] as Playlist[],
  followed: [] as string[], // artist names
  features: {} as Record<string, Features>,
  hidden: [] as string[], // "hide this song"
  banned: [] as string[], // "don't play this artist" (lowercase)
  plays: {} as Record<string, number>,
}, 'lumen.library')

const set = useLibrary.set
export const remember = (ts: Track[]) => set((s) => ({ tracks: { ...s.tracks, ...Object.fromEntries(ts.map((t) => [t.id, { ...s.tracks[t.id], ...t }])) } }))
const toggleIn = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [id, ...arr])

export const library = {
  remember,
  isLiked: (id: string) => useLibrary.get().liked.includes(id),
  toggleLike(t: Track) { remember([t]); set((s) => ({ liked: toggleIn(s.liked, t.id) })) },
  save(ts: Track[]) { remember(ts); set((s) => ({ saved: [...new Set([...ts.map((t) => t.id), ...s.saved])] })) },
  unsave(id: string) { set((s) => ({ saved: s.saved.filter((x) => x !== id) })) },
  addLocal(ts: Track[]) { remember(ts); set((s) => ({ local: [...new Set([...s.local, ...ts.map((t) => t.id)])] })) },
  removeLocal(id: string) { set((s) => ({ local: s.local.filter((x) => x !== id) })) },
  pushHistory(t: Track) {
    remember([t])
    set((s) => ({ history: [t.id, ...s.history.filter((x) => x !== t.id)].slice(0, 300), plays: { ...s.plays, [t.id]: (s.plays[t.id] ?? 0) + 1 } }))
  },
  setFeatures(map: Record<string, Features>) { set((s) => ({ features: { ...s.features, ...Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { ...s.features[k], ...v }])) } })) },
  hide(id: string) { set((s) => ({ hidden: toggleIn(s.hidden, id) })) },
  ban(artist: string) { set((s) => ({ banned: toggleIn(s.banned, artist.toLowerCase()) })) },
  follow(artist: string) { set((s) => ({ followed: toggleIn(s.followed, artist) })) },
  createPlaylist(name: string, trackIds: string[] = [], extra: Partial<Playlist> = {}) {
    const p: Playlist = { id: crypto.randomUUID(), name, trackIds, createdAt: Date.now(), ...extra }
    set((s) => ({ playlists: [...s.playlists, p] }))
    return p
  },
  updatePlaylist(id: string, patch: Partial<Playlist>) { set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...patch } : p)) })) },
  deletePlaylist(id: string) { set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })) },
  addToPlaylist(id: string, ts: Track[]) {
    remember(ts)
    set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds: [...new Set([...p.trackIds, ...ts.map((t) => t.id)])] } : p)) }))
  },
  removeFromPlaylist(id: string, trackId: string) { set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds: p.trackIds.filter((x) => x !== trackId) } : p)) })) },
  moveInPlaylist(id: string, from: number, to: number) {
    set((s) => ({ playlists: s.playlists.map((p) => {
      if (p.id !== id) return p
      const ids = [...p.trackIds]; const [m] = ids.splice(from, 1); ids.splice(to, 0, m)
      return { ...p, trackIds: ids }
    }) }))
  },
}

export const resolve = (ids: string[]) => { const all = useLibrary.get().tracks; return ids.map((id) => all[id]).filter(Boolean) }

/** Everything in the library: saved + liked + local + playlist tracks. */
export function allTracks(): Track[] {
  const s = useLibrary.get()
  const ids = new Set([...s.saved, ...s.liked, ...s.local, ...s.playlists.flatMap((p) => p.trackIds)])
  return resolve([...ids])
}

export const playable = (t: Track) => {
  const s = useLibrary.get()
  return !s.hidden.includes(t.id) && !s.banned.includes(t.artist.toLowerCase())
}

/** Evaluate smart playlist rules against the library. */
export function smartTracks(rules: SmartRule[]): Track[] {
  const s = useLibrary.get()
  return allTracks().filter((t) => rules.every((r) => {
    const f = s.features[t.id] ?? {}
    const val: string | number | undefined =
      r.field === 'genre' ? f.genre ?? t.genre : r.field === 'mood' ? f.mood : r.field === 'bpm' ? f.bpm : r.field === 'energy' ? f.energy
      : r.field === 'artist' ? t.artist : r.field === 'plays' ? s.plays[t.id] ?? 0 : s.liked.includes(t.id) ? 'yes' : 'no'
    if (val === undefined) return false
    if (r.op === 'gt') return Number(val) > Number(r.value)
    if (r.op === 'lt') return Number(val) < Number(r.value)
    if (r.op === 'contains') return String(val).toLowerCase().includes(r.value.toLowerCase())
    return String(val).toLowerCase() === r.value.toLowerCase()
  }))
}

export const trackKey = (title: string, artist: string) => 'ref:' + (artist + '|' + title).toLowerCase().replace(/\s+/g, ' ').trim()
export const refTrack = (title: string, artist: string, extra: Partial<Track> = {}): Track =>
  ({ id: trackKey(title, artist), source: 'ref', title, artist, duration: 0, artwork: null, ...extra })
