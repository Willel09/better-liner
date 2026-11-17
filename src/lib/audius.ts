// Audius public API: open catalog with free streaming. https://docs.audius.org
import type { Album, Artist, Track } from './types'

const API = 'https://api.audius.co/v1'
const APP = 'app_name=lumen'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}${APP}`)
  if (!res.ok) throw new Error(`Audius ${res.status}`)
  return (await res.json()).data as T
}

const art = (a: any) => a?.['480x480'] ?? a?.['1000x1000'] ?? a?.['150x150'] ?? null

export const toTrack = (t: any): Track => ({
  id: 'audius:' + t.id,
  source: 'audius',
  title: t.title,
  artist: t.user?.name ?? '',
  artistId: t.user?.id,
  album: t.album_backlink?.playlist_name,
  duration: t.duration ?? 0,
  artwork: art(t.artwork),
})

const toArtist = (u: any): Artist => ({
  id: u.id, name: u.name, handle: u.handle, avatar: art(u.profile_picture),
  cover: u.cover_photo?.['2000x'] ?? u.cover_photo?.['640x'] ?? null,
  followers: u.follower_count ?? 0, bio: u.bio,
})

const toAlbum = (p: any): Album => ({ id: p.id, name: p.playlist_name, artist: p.user?.name ?? '', artwork: art(p.artwork), trackCount: p.track_count ?? 0 })

const playable = (ts: any[]) => ts.filter((t) => t.is_streamable !== false && !t.is_delete).map(toTrack)

export const streamUrl = (id: string) => `${API}/tracks/${id.replace('audius:', '')}/stream?${APP}`

export const audius = {
  trending: (genre?: string, time: 'week' | 'month' | 'allTime' = 'week') =>
    get<any[]>(`/tracks/trending?time=${time}${genre ? '&genre=' + encodeURIComponent(genre) : ''}`).then(playable),
  trendingPlaylists: () => get<any[]>('/playlists/trending?limit=12').then((ps) => ps.map(toAlbum)),
  searchTracks: (q: string) => get<any[]>(`/tracks/search?query=${encodeURIComponent(q)}`).then(playable),
  searchArtists: (q: string) => get<any[]>(`/users/search?query=${encodeURIComponent(q)}`).then((us) => us.map(toArtist)),
  searchAlbums: (q: string) => get<any[]>(`/playlists/search?query=${encodeURIComponent(q)}`).then((ps) => ps.map(toAlbum)),
  artist: (id: string) => get<any>(`/users/${id}`).then(toArtist),
  artistTracks: (id: string) => get<any[]>(`/users/${id}/tracks?sort=plays&limit=50`).then(playable),
  album: (id: string) => get<any[]>(`/playlists/${id}`).then((ps) => toAlbum(ps[0])),
  albumTracks: (id: string) => get<any[]>(`/playlists/${id}/tracks`).then(playable),
  track: (id: string) => get<any>(`/tracks/${id.replace('audius:', '')}`).then(toTrack),
}

export const GENRES = ['Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Alternative', 'House', 'Lo-Fi', 'Ambient', 'Rock', 'Jazz']
