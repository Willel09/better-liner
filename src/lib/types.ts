// A track the app knows about. YouTube tracks have a videoId; imported/AI-suggested tracks start as
// references (title + artist only) and get a videoId the first time they are played.
export type Track = {
  id: string
  source: 'yt' | 'local' | 'ref'
  title: string
  artist: string
  album?: string
  duration: number // seconds (0 = unknown)
  artwork: string | null
  videoId?: string
  path?: string // local file
  genre?: string
}

export type Features = {
  genre?: string
  mood?: string // e.g. happy, chill, sad, energetic, dark, romantic, focused
  energy?: number // 0..1
  valence?: number // 0..1 (sad -> happy)
  danceability?: number // 0..1
  bpm?: number
  loudnessDb?: number // local files only, for auto-gain
  by?: 'ai' | 'local'
}

export type SmartRule = { field: 'genre' | 'mood' | 'bpm' | 'energy' | 'artist' | 'liked' | 'plays'; op: 'is' | 'contains' | 'gt' | 'lt'; value: string }

export type Playlist = {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  folder?: string
  smart?: SmartRule[]
  ai?: string // prompt it was generated from
}

export type Route =
  | { name: 'home' }
  | { name: 'discover' }
  | { name: 'search'; q?: string }
  | { name: 'library' }
  | { name: 'playlists' }
  | { name: 'playlist'; id: string }
  | { name: 'liked' }
  | { name: 'artists' }
  | { name: 'artist'; name_: string }
  | { name: 'albums' }
  | { name: 'album'; key: string }
  | { name: 'now' }
  | { name: 'studio' }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'similar'; id: string }
