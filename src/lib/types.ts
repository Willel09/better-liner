export type Track = {
  id: string
  source: 'audius' | 'local'
  title: string
  artist: string
  artistId?: string
  album?: string
  duration: number // seconds
  artwork: string | null
  url?: string // local / downloaded file URL
  path?: string
}

export type Artist = { id: string; name: string; handle: string; avatar: string | null; cover: string | null; followers: number; bio?: string }

export type Album = { id: string; name: string; artist: string; artwork: string | null; trackCount: number }

export type Playlist = { id: string; name: string; trackIds: string[]; createdAt: number }

export type Route =
  | { name: 'home' }
  | { name: 'search'; q?: string }
  | { name: 'library' }
  | { name: 'liked' }
  | { name: 'local' }
  | { name: 'downloads' }
  | { name: 'history' }
  | { name: 'playlist'; id: string }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }

declare global {
  interface Window {
    lumen?: {
      pickLocal(kind: 'folder' | 'files'): Promise<Track[]>
      localExists(paths: string[]): Promise<boolean[]>
      download(id: string, url: string): Promise<string>
      removeDownload(id: string): Promise<void>
      clearCache(): Promise<void>
      cacheSize(): Promise<number>
      info(): Promise<{ platform: string; version: string; dark: boolean }>
      toggleOverlay(): void
      resizeOverlay(h: number): void
      sendState(s: unknown): void
      sendCommand(c: string): void
      discord(clientId: string, track: unknown): void
      setFullscreen(on: boolean): void
      onState(cb: (s: any) => void): () => void
      onCommand(cb: (c: string) => void): () => void
      onOverlay(cb: (open: boolean) => void): () => void
      onDeepLink(cb: (url: string) => void): () => void
    }
  }
}
