// Lyrics from LRCLIB (open lyrics database, https://lrclib.net). Fetched at runtime, cached per track.
import { parseLrc, type Line } from './lrc'
import type { Track } from './types'

export type Lyrics = { synced: boolean; lines: Line[] } | null

const cache = new Map<string, Lyrics>()
const clean = (s: string) => s.replace(/\s*[([].*?(feat|ft|prod|official|video|audio|lyrics?).*?[)\]]/gi, '').trim()

async function query(path: string) {
  const res = await fetch('https://lrclib.net/api' + path)
  return res.ok ? res.json() : null
}

export async function fetchLyrics(t: Track): Promise<Lyrics> {
  if (cache.has(t.id)) return cache.get(t.id)!
  const title = clean(t.title), artist = clean(t.artist)
  let hit = await query(`/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}${t.duration ? '&duration=' + Math.round(t.duration) : ''}`).catch(() => null)
  if (!hit?.syncedLyrics && !hit?.plainLyrics) {
    const list: any[] = (await query(`/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`).catch(() => null)) ?? []
    // Prefer a synced result whose length is within 5 s of the track.
    hit = list.find((r) => r.syncedLyrics && (!t.duration || Math.abs(r.duration - t.duration) < 5)) ?? list.find((r) => r.syncedLyrics) ?? list[0]
  }
  let out: Lyrics = null
  if (hit?.syncedLyrics) out = { synced: true, lines: parseLrc(hit.syncedLyrics, t.duration) }
  else if (hit?.plainLyrics) out = { synced: false, lines: hit.plainLyrics.split('\n').map((text: string) => ({ time: 0, end: 0, text, words: [] })) }
  cache.set(t.id, out)
  return out
}
