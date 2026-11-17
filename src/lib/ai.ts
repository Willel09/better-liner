// AI features over any OpenAI-compatible chat API (Mistral, DeepSeek, …). The key lives in Rust.
// Only track metadata and derived numbers are sent — never audio.
import { api, type Stats } from './api'
import type { Features, Track } from './types'
import { allTracks, library, refTrack, useLibrary } from '../store/library'
import { useSettings } from '../store/settings'

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

const lang = () => (useSettings.get().lang === 'sv' ? 'Swedish' : 'English')
const line = (t: Track, f?: Features) =>
  `${t.id} | ${t.artist} – ${t.title}${f?.genre ? ` | ${f.genre}` : ''}${f?.mood ? ` | ${f.mood}` : ''}${f?.bpm ? ` | ${Math.round(f.bpm)} bpm` : ''}`

export function parseJson<T>(s: string): T {
  try { return JSON.parse(s) } catch {
    const m = s.match(/\{[\s\S]*\}/) // some models wrap JSON in prose or code fences
    if (m) return JSON.parse(m[0])
    throw new Error('ai:invalid JSON')
  }
}

async function askJson<T>(system: string, user: string, cacheKey?: string): Promise<T> {
  const raw = await api.ai([{ role: 'system', content: system + '\nReply with a single JSON object only.' }, { role: 'user', content: user }], true, cacheKey)
  return parseJson<T>(raw)
}

const MOODS = ['happy', 'chill', 'sad', 'energetic', 'dark', 'romantic', 'focused', 'angry', 'dreamy', 'uplifting'] as const
export const MOOD_LIST = MOODS

// ---------- 2–4. Mood, genre, BPM ----------
/** Classify tracks that have no features yet. Local files get real BPM/loudness from Rust first. */
export async function analyzeTracks(tracks: Track[], onProgress?: (done: number, total: number) => void) {
  const feats = useLibrary.get().features
  const todo = tracks.filter((t) => !feats[t.id]?.mood)
  for (const t of tracks.filter((t) => t.source === 'local' && t.path && feats[t.id]?.bpm === undefined)) {
    try {
      const a = await api.analyze(t.path!)
      library.setFeatures({ [t.id]: { bpm: a.bpm || undefined, loudnessDb: a.loudness_db, energy: a.energy, by: 'local' } })
    } catch { /* unreadable file: AI estimate below still applies */ }
  }
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20)
    const res = await askJson<{ tracks: { id: string; genre: string; mood: string; energy: number; valence: number; danceability: number; bpm: number }[] }>(
      `You are a music analyst. For each track, give its main genre (1-2 words), mood (one of: ${MOODS.join(', ')}), energy, valence and danceability (0-1), and typical tempo in BPM. Use your knowledge of the song; if unknown, infer from artist and title.`,
      `Tracks (id | artist – title):\n${batch.map((t) => `${t.id} | ${t.artist} – ${t.title}`).join('\n')}\n\nJSON: {"tracks":[{"id","genre","mood","energy","valence","danceability","bpm"}]}`,
    )
    const cur = useLibrary.get().features
    library.setFeatures(Object.fromEntries((res.tracks ?? []).filter((r) => batch.some((t) => t.id === r.id)).map((r) => [r.id, {
      genre: r.genre, mood: MOODS.includes(r.mood as any) ? r.mood : r.mood?.toLowerCase(),
      energy: cur[r.id]?.by === 'local' ? cur[r.id].energy : r.energy, valence: r.valence, danceability: r.danceability,
      bpm: cur[r.id]?.by === 'local' && cur[r.id].bpm ? cur[r.id].bpm : r.bpm, by: cur[r.id]?.by ?? 'ai',
    } satisfies Features])))
    onProgress?.(Math.min(i + 20, todo.length), todo.length)
  }
}

// ---------- 1. Playlist builder ----------
export async function buildPlaylist(prompt: string, size = 25) {
  const feats = useLibrary.get().features
  const lib = allTracks().slice(0, 250)
  const res = await askJson<{ name: string; description: string; library: string[]; suggestions: { title: string; artist: string }[] }>(
    `You build playlists. Prefer songs from the user's library when they fit; fill the rest with real, existing songs. Order them so the playlist flows. Write name and description in ${lang()}.`,
    `Request: "${prompt}"\nTarget length: ${size} songs.\n\nLibrary (id | artist – title | genre | mood | bpm):\n${lib.map((t) => line(t, feats[t.id])).join('\n') || '(empty)'}\n\nJSON: {"name","description","library":[ids from the library],"suggestions":[{"title","artist"}]}`,
  )
  const known = new Map(lib.map((t) => [t.id, t]))
  const fromLib = (res.library ?? []).map((id) => known.get(id)).filter(Boolean) as Track[]
  const fresh = (res.suggestions ?? []).filter((s) => s.title).map((s) => refTrack(s.title, s.artist ?? ''))
  const tracks = [...fromLib, ...fresh].slice(0, size + 5)
  const pl = library.createPlaylist(res.name || prompt, [], { ai: prompt })
  library.addToPlaylist(pl.id, tracks)
  return { playlist: pl, description: res.description, tracks }
}

// ---------- 5. Similar tracks / 9. Smart radio ----------
export async function similarTo(t: Track, n = 12): Promise<(Track & { why?: string })[]> {
  const res = await askJson<{ tracks: { title: string; artist: string; why: string }[] }>(
    `You recommend music. Suggest real, existing songs similar in sound, mood and era — mix well-known and lesser-known artists, at most 2 per artist, never the seed song itself. "why" is max 8 words in ${lang()}.`,
    `Seed: ${t.artist} – ${t.title}\nCount: ${n}\nJSON: {"tracks":[{"title","artist","why"}]}`,
    `similar:${t.artist}|${t.title}:${n}`.toLowerCase(),
  )
  return (res.tracks ?? []).filter((s) => s.title).map((s) => ({ ...refTrack(s.title, s.artist ?? ''), why: s.why }))
}

// ---------- 6. Discovery ----------
export async function discover(stats: Stats | null) {
  const s = useLibrary.get()
  const lib = allTracks()
  const top = stats?.top_artists.slice(0, 10).map((a) => a.key) ?? [...new Set(lib.map((t) => t.artist))].slice(0, 10)
  const genres = stats?.top_genres.slice(0, 6).map((g) => g.key) ?? []
  const day = new Date().toISOString().slice(0, 10)
  const res = await askJson<{ picks: { title: string; artist: string; why: string }[]; theme: string }>(
    `You are a music discovery engine. Recommend real songs the listener probably hasn't heard, by artists NOT in their top list, matching their taste but stretching it a little. "why" max 10 words, "theme" a short headline — both in ${lang()}.`,
    `Top artists: ${top.join(', ') || 'unknown'}\nTop genres: ${genres.join(', ') || 'unknown'}\nLiked: ${s.liked.slice(0, 15).map((id) => s.tracks[id]).filter(Boolean).map((t) => `${t.artist} – ${t.title}`).join('; ')}\nCount: 16\nJSON: {"theme","picks":[{"title","artist","why"}]}`,
    `discover:${day}:${top.join(',')}`.toLowerCase(),
  )
  // Rediscover: library tracks liked or saved long ago but rarely played.
  const rare = lib.filter((t) => (s.plays[t.id] ?? 0) <= 1).sort(() => Math.random() - 0.5).slice(0, 12)
  return { theme: res.theme, picks: (res.picks ?? []).map((p) => ({ ...refTrack(p.title, p.artist ?? ''), why: p.why })), rediscover: rare }
}

// ---------- 7. AI DJ ----------
/** Order tracks so tempo, energy and mood change smoothly (greedy nearest neighbour in feature space). */
export function djOrder(tracks: Track[], feats: Record<string, Features>): Track[] {
  const vec = (t: Track) => { const f = feats[t.id] ?? {}; return [(f.bpm ?? 110) / 60, (f.energy ?? 0.5) * 2, (f.valence ?? 0.5) * 1.5] }
  const pool = [...tracks]
  if (!pool.length) return []
  pool.sort((a, b) => vec(a)[1] - vec(b)[1])
  const out = [pool.shift()!]
  while (pool.length) {
    const last = vec(out[out.length - 1])
    let bi = 0, bd = Infinity
    pool.forEach((t, i) => {
      const v = vec(t)
      // Gentle upward drift in energy for the first two thirds, then ease off.
      const drift = out.length < tracks.length * 0.66 ? (v[1] < last[1] ? 0.3 : 0) : (v[1] > last[1] ? 0.3 : 0)
      const d = Math.hypot(v[0] - last[0], v[1] - last[1], v[2] - last[2]) + drift + (t.artist === out[out.length - 1].artist ? 1 : 0)
      if (d < bd) { bd = d; bi = i }
    })
    out.push(pool.splice(bi, 1)[0])
  }
  return out
}

export async function djSession(vibe: string, seed: Track[]) {
  let tracks = seed
  if (tracks.length < 12) tracks = [...tracks, ...(await buildPlaylistRefs(vibe, 20 - tracks.length))]
  await analyzeTracks(tracks).catch(() => {})
  const ordered = djOrder(tracks, useLibrary.get().features)
  const res = await askJson<{ intro: string; segues: { at: number; text: string }[] }>(
    `You are a warm, concise radio DJ. Write a short intro (max 30 words) and up to 4 segues (max 20 words each) placed before track index "at". Mention songs by name. Language: ${lang()}.`,
    `Vibe: ${vibe}\nSet list:\n${ordered.map((t, i) => `${i}. ${t.artist} – ${t.title}`).join('\n')}\nJSON: {"intro","segues":[{"at","text"}]}`,
  )
  return { tracks: ordered, intro: res.intro, segues: res.segues ?? [] }
}

async function buildPlaylistRefs(vibe: string, n: number): Promise<Track[]> {
  const res = await askJson<{ tracks: { title: string; artist: string }[] }>(
    'You pick real, existing songs for a DJ set. Mix artists; at most 2 songs per artist.',
    `Vibe: ${vibe}\nCount: ${n}\nJSON: {"tracks":[{"title","artist"}]}`,
  )
  return (res.tracks ?? []).filter((t) => t.title).map((t) => refTrack(t.title, t.artist ?? ''))
}

// ---------- 8. Listening assistant ----------
export async function assistant(history: Msg[], stats: Stats | null, nowPlaying: Track | null) {
  const s = useLibrary.get()
  const lib = allTracks()
  const context = [
    `Now playing: ${nowPlaying ? `${nowPlaying.artist} – ${nowPlaying.title}` : 'nothing'}`,
    `Library: ${lib.length} tracks, ${s.liked.length} liked, ${s.playlists.length} playlists (${s.playlists.map((p) => p.name).slice(0, 20).join(', ')})`,
    stats ? `Last 30 days: ${Math.round(stats.minutes)} min, ${stats.plays} plays. Top artists: ${stats.top_artists.slice(0, 10).map((a) => `${a.key} (${a.plays})`).join(', ')}. Top tracks: ${stats.top_tracks.slice(0, 10).map((t) => `${t.sub} – ${t.key} (${t.plays})`).join(', ')}. Top genres: ${stats.top_genres.slice(0, 6).map((g) => g.key).join(', ')}. Moods: ${stats.top_moods.slice(0, 5).map((m) => m.key).join(', ')}. Listening by hour: ${stats.by_hour.map((m) => Math.round(m)).join(',')}` : 'No listening statistics yet.',
    `Sample of library: ${lib.slice(0, 80).map((t) => `${t.artist} – ${t.title}`).join('; ')}`,
  ].join('\n')
  return api.ai([
    { role: 'system', content: `You are Lumen's listening assistant. Answer questions about the user's music, taste and listening habits using the context. Be concise and specific. Use ${lang()}. When recommending songs, list them as "Artist – Title".\n\nContext:\n${context}` },
    ...history.slice(-12),
  ])
}

// ---------- 10. Music DNA ----------
export type Dna = { axes: { key: string; value: number }[]; genres: { key: string; share: number }[]; title?: string; summary?: string }

export function dnaFrom(stats: Stats | null): Dna {
  const s = useLibrary.get()
  const weighted = Object.entries(s.plays).map(([id, n]) => [s.features[id], n] as const).filter(([f]) => f)
  const avg = (k: keyof Features, fallback = 0.5) => {
    let sum = 0, w = 0
    weighted.forEach(([f, n]) => { const v = f![k]; if (typeof v === 'number') { sum += v * n; w += n } })
    return w ? sum / w : fallback
  }
  const genres = new Map<string, number>()
  weighted.forEach(([f, n]) => f!.genre && genres.set(f!.genre.toLowerCase(), (genres.get(f!.genre.toLowerCase()) ?? 0) + n))
  const totalG = [...genres.values()].reduce((a, b) => a + b, 0) || 1
  const artists = new Set(s.history.map((id) => s.tracks[id]?.artist)).size
  const plays = Object.values(s.plays).reduce((a, b) => a + b, 0) || 1
  return {
    axes: [
      { key: 'energy', value: avg('energy') },
      { key: 'happiness', value: avg('valence') },
      { key: 'danceability', value: avg('danceability') },
      { key: 'tempo', value: Math.max(0, Math.min(1, (avg('bpm', 110) - 60) / 120)) },
      { key: 'variety', value: Math.min(1, genres.size / 12) },
      { key: 'discovery', value: Math.min(1, artists / plays * 2) },
    ],
    genres: [...genres].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, n]) => ({ key, share: n / totalG })),
    ...(stats ? {} : {}),
  }
}

export async function dnaProfile(d: Dna) {
  const week = Math.floor(Date.now() / 6048e5)
  return askJson<{ title: string; summary: string }>(
    `You describe a listener's musical identity like a playful personality profile. "title" max 4 words, "summary" max 45 words, both in ${lang()}.`,
    `Axes (0-1): ${d.axes.map((a) => `${a.key}=${a.value.toFixed(2)}`).join(', ')}\nGenres: ${d.genres.map((g) => `${g.key} ${(g.share * 100).toFixed(0)}%`).join(', ')}\nJSON: {"title","summary"}`,
    `dna:${week}:${d.axes.map((a) => a.value.toFixed(1)).join(',')}`,
  )
}
