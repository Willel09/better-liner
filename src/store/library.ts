import type { Playlist, Track } from '../lib/types'
import { create } from './create'

export const useLibrary = create({
  tracks: {} as Record<string, Track>, // every track the library references
  liked: [] as string[],
  local: [] as string[],
  downloads: {} as Record<string, string>, // track id -> lumen-file:// url
  history: [] as string[],
  playlists: [] as Playlist[],
  savedAlbums: [] as { id: string; name: string; artist: string; artwork: string | null }[],
  followed: [] as { id: string; name: string; avatar: string | null }[],
}, 'lumen.library')

const remember = (ts: Track[]) => useLibrary.set((s) => ({ tracks: { ...s.tracks, ...Object.fromEntries(ts.map((t) => [t.id, t])) } }))

export const library = {
  remember,
  isLiked: (id: string) => useLibrary.get().liked.includes(id),
  toggleLike(t: Track) {
    remember([t])
    useLibrary.set((s) => ({ liked: s.liked.includes(t.id) ? s.liked.filter((x) => x !== t.id) : [t.id, ...s.liked] }))
  },
  addLocal(ts: Track[]) {
    remember(ts)
    useLibrary.set((s) => ({ local: [...new Set([...s.local, ...ts.map((t) => t.id)])] }))
  },
  removeLocal(id: string) {
    useLibrary.set((s) => ({ local: s.local.filter((x) => x !== id) }))
  },
  pushHistory(t: Track) {
    remember([t])
    useLibrary.set((s) => ({ history: [t.id, ...s.history.filter((x) => x !== t.id)].slice(0, 200) }))
  },
  async download(t: Track, url: string) {
    remember([t])
    const file = await window.lumen!.download(t.id, url)
    useLibrary.set((s) => ({ downloads: { ...s.downloads, [t.id]: file } }))
  },
  async removeDownload(id: string) {
    await window.lumen?.removeDownload(id)
    useLibrary.set((s) => { const d = { ...s.downloads }; delete d[id]; return { downloads: d } })
  },
  createPlaylist(name: string, trackIds: string[] = []) {
    const p: Playlist = { id: crypto.randomUUID(), name, trackIds, createdAt: Date.now() }
    useLibrary.set((s) => ({ playlists: [...s.playlists, p] }))
    return p
  },
  renamePlaylist(id: string, name: string) {
    useLibrary.set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)) }))
  },
  deletePlaylist(id: string) {
    useLibrary.set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }))
  },
  addToPlaylist(id: string, t: Track) {
    remember([t])
    useLibrary.set((s) => ({ playlists: s.playlists.map((p) => (p.id === id && !p.trackIds.includes(t.id) ? { ...p, trackIds: [...p.trackIds, t.id] } : p)) }))
  },
  removeFromPlaylist(id: string, trackId: string) {
    useLibrary.set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds: p.trackIds.filter((x) => x !== trackId) } : p)) }))
  },
  moveInPlaylist(id: string, from: number, to: number) {
    useLibrary.set((s) => ({ playlists: s.playlists.map((p) => {
      if (p.id !== id) return p
      const ids = [...p.trackIds]; const [m] = ids.splice(from, 1); ids.splice(to, 0, m)
      return { ...p, trackIds: ids }
    }) }))
  },
  toggleAlbum(a: { id: string; name: string; artist: string; artwork: string | null }) {
    useLibrary.set((s) => ({ savedAlbums: s.savedAlbums.some((x) => x.id === a.id) ? s.savedAlbums.filter((x) => x.id !== a.id) : [a, ...s.savedAlbums] }))
  },
  toggleFollow(a: { id: string; name: string; avatar: string | null }) {
    useLibrary.set((s) => ({ followed: s.followed.some((x) => x.id === a.id) ? s.followed.filter((x) => x.id !== a.id) : [a, ...s.followed] }))
  },
}

export const resolve = (ids: string[]) => {
  const all = useLibrary.get().tracks
  return ids.map((id) => all[id]).filter(Boolean)
}
