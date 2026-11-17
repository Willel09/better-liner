// Thin layer over the Rust backend. Outside Tauri (plain browser during UI work) calls fail softly.
import { invoke as tauriInvoke, convertFileSrc } from '@tauri-apps/api/core'
import { emit as tauriEmit, emitTo as tauriEmitTo, listen as tauriListen } from '@tauri-apps/api/event'

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) return Promise.reject(new Error('desktop-only'))
  return tauriInvoke<T>(cmd, args)
}

export type YtVideo = { id: string; title: string; channel: string; thumb: string; duration: number }
export type ConfigStatus = { youtube: boolean; ai: boolean; ai_base: string; ai_model: string; spotify: boolean }
export type Count = { key: string; sub: string; plays: number; minutes: number }
export type Stats = {
  minutes: number; plays: number; tracks: number; artists: number
  top_tracks: Count[]; top_artists: Count[]; top_genres: Count[]; top_moods: Count[]
  by_hour: number[]; by_day: [number, number][]
}
export type Imported = { name: string; source: string; tracks: { title: string; artist: string; album: string; duration: number }[] }
export type LocalTrack = { id: string; path: string; title: string; artist: string; album: string; genre: string; duration: number; cover: string | null }

export const api = {
  platform: () => invoke<string>('platform'),
  configStatus: () => invoke<ConfigStatus>('config_status'),
  configSet: (patch: Record<string, string>) => invoke<void>('config_set', { patch }),
  ytSearch: (q: string, max = 15) => invoke<YtVideo[]>('yt_search', { q, max }),
  ai: (messages: { role: 'system' | 'user' | 'assistant'; content: string }[], json = false, cacheKey?: string) =>
    invoke<string>('ai_chat', { messages, json, cacheKey }),
  importPlaylist: (url: string) => invoke<Imported>('import_playlist', { url }),
  localScan: (paths: string[]) => invoke<LocalTrack[]>('local_scan', { paths }),
  localAllow: (paths: string[]) => invoke<void>('local_allow', { paths }),
  analyze: (path: string) => invoke<{ bpm: number; loudness_db: number; energy: number }>('analyze_file', { path }),
  playLog: (a: { trackId: string; title: string; artist: string; genre?: string; mood?: string; seconds: number }) => invoke<void>('play_log', a),
  stats: (days: number) => invoke<Stats>('stats', { days, tzOffsetMin: -new Date().getTimezoneOffset() }),
  miniToggle: () => invoke<boolean>('mini_toggle'),
  ytmOpen: (url?: string) => invoke<void>('ytm_open', { url }),
  discord: (clientId: string, t?: { title: string; artist: string; start?: number; end?: number }) =>
    invoke<void>('discord_update', { clientId, title: t?.title, artist: t?.artist, start: t?.start, end: t?.end }).catch(() => {}),
}

export const fileSrc = (path: string) => (isTauri ? convertFileSrc(path) : path)

export function emit(event: string, payload?: unknown) {
  if (isTauri) tauriEmit(event, payload).catch(() => {})
}
export function emitTo(target: string, event: string, payload?: unknown) {
  if (isTauri) tauriEmitTo(target, event, payload).catch(() => {})
}
export const ytmSearchUrl = (q: string) => 'https://music.youtube.com/search?q=' + encodeURIComponent(q)
export function listen<T>(event: string, cb: (p: T) => void): () => void {
  if (!isTauri) return () => {}
  let off: (() => void) | null = null, dead = false
  tauriListen<T>(event, (e) => cb(e.payload)).then((u) => (dead ? u() : (off = u)))
  return () => { dead = true; off?.() }
}

/** Human message for backend error codes. */
export function errText(e: unknown, sv: boolean): string {
  const m = String((e as Error)?.message ?? e)
  const map: Record<string, [string, string]> = {
    'youtube:nokey': ['Lägg till en YouTube API-nyckel i Inställningar → Integrationer.', 'Add a YouTube API key in Settings → Integrations.'],
    'youtube:quota': ['YouTube-kvoten för idag är slut. Den återställs vid midnatt (Stillahavstid).', 'Today’s YouTube quota is used up. It resets at midnight Pacific time.'],
    'youtube:key': ['YouTube-nyckeln är ogiltig.', 'The YouTube key is invalid.'],
    'ai:nokey': ['Lägg till en AI-nyckel (Mistral eller DeepSeek) i Inställningar → Integrationer.', 'Add an AI key (Mistral or DeepSeek) in Settings → Integrations.'],
    'import:unsupported': ['Länken stöds inte. Klistra in låtlistan som text i stället.', 'Unsupported link. Paste the track list as text instead.'],
    'import:spotify-nokey': ['Spotify-import kräver ett Client ID och Secret i Inställningar → Integrationer.', 'Spotify import needs a Client ID and Secret in Settings → Integrations.'],
    'youtube:150': ['Den här videon får inte spelas utanför YouTube.', 'This video can’t be played outside YouTube.'],
    'youtube:101': ['Den här videon får inte spelas utanför YouTube.', 'This video can’t be played outside YouTube.'],
    'youtube:153': ['YouTube-spelaren saknar giltig ursprungsadress.', 'The YouTube player is missing a valid origin.'],
    'nomatch': ['Hittade ingen matchande låt på YouTube.', 'No matching song found on YouTube.'],
    'desktop-only': ['Fungerar bara i skrivbordsappen.', 'Only works in the desktop app.'],
  }
  const hit = Object.keys(map).find((k) => m.includes(k))
  return hit ? map[hit][sv ? 0 : 1] : m.replace(/^(ai|youtube|import):/, '')
}
