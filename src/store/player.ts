// Playback engine.
//  - Local files play in Echo: two <audio> slots (crossfade) through Web Audio (EQ, auto-gain, visuals).
//  - Everything from YouTube plays in the YouTube Music window (official site, user's own account).
//    Echo shows only the cover art; its queue, Smart Shuffle, radio and AI lists decide what plays there.
import { api, emitTo, fileSrc, listen, ytmSearchUrl } from '../lib/api'
import { bestMatch } from '../lib/match'
import { smartShuffle } from '../lib/shuffle'
import type { Track } from '../lib/types'
import { create } from './create'
import { library, playable, remember, useLibrary } from './library'
import { countYtSearch, EQ_BANDS, useSettings } from './settings'

export const usePlayer = create({
  queue: [] as Track[],
  original: [] as Track[],
  index: -1,
  playing: false,
  loading: false,
  error: '',
  shuffle: false,
  repeat: 'off' as 'off' | 'all' | 'one',
  muted: false,
  sleepAt: 0, // epoch ms, 0 = off, -1 = end of current track
  radioBusy: false,
})
export const useTime = create({ position: 0, duration: 0, buffered: 0 })
export const useYtm = create({ open: false, active: false })

// ---------- YouTube Music window as a source ----------
// When the YouTube Music window plays, Echo mirrors it (player bar, lyrics, stats, mini player)
// and routes its transport buttons there. Starting playback in Echo hands control back.
let ytmAt = 0, ytmPos = 0
// "driving": Echo's queue picked the song now playing in YouTube Music (vs. mirroring what the user picked there).
let driving = false, expected = '', previous = '', navAt = 0, lastRemaining = 99
const ytm = (cmd: string, arg?: number) => emitTo('ytm', 'ytm:command', { cmd, arg })
const ytmActive = () => useYtm.get().active
type YtmState = { id: string; title: string; artist: string; album: string; artwork: string; playing: boolean; position: number; duration: number }
listen<boolean>('ytm:open', (open) => useYtm.set(open ? { open } : { open, active: false }))
listen<YtmState>('ytm:state', (s) => {
  if (driving) {
    // The old song can still report for a moment after Echo asked for the next one.
    if (s.id && s.id === previous && performance.now() - navAt < 8000) return
    if (s.id && expected && s.id !== expected) {
      // YouTube Music moved on by itself at the end of a song: follow Echo's queue instead.
      if (lastRemaining < 6) { lastRemaining = 99; next(true); return }
      driving = false // the user picked something else in YouTube Music: mirror it below
    } else {
      if (s.playing) failures = 0
      ytmAt = performance.now(); ytmPos = s.position
      lastRemaining = s.duration ? s.duration - s.position : 99
      usePlayer.set({ playing: s.playing, loading: false })
      useTime.set({ position: s.position, duration: s.duration || useTime.get().duration, buffered: s.duration })
      if (!s.playing && s.duration > 0 && s.duration - s.position < 1) { lastRemaining = 99; next(true) }
      return
    }
  }
  if (s.playing && !ytmActive()) {
    // YouTube Music took over: silence Echo's own decks.
    slots.forEach((x) => x.audio.pause())
    useYtm.set({ active: true })
  }
  if (!ytmActive()) return
  const id = 'ytm:' + (s.id || (s.artist + '|' + s.title).toLowerCase())
  if (current()?.id !== id) {
    finishListen()
    const t: Track = { id, source: 'ytm', title: s.title, artist: s.artist, album: s.album || undefined, duration: Math.round(s.duration), artwork: s.artwork || null, videoId: s.id || undefined }
    usePlayer.set({ queue: [t], original: [t], index: 0, error: '' })
    begin(t)
  }
  ytmAt = performance.now(); ytmPos = s.position
  usePlayer.set({ playing: s.playing, loading: false })
  useTime.set({ position: s.position, duration: s.duration || useTime.get().duration, buffered: s.duration })
})
export const current = () => usePlayer.get().queue[usePlayer.get().index] ?? null

// ---------- slots ----------
type Slot = { audio: HTMLAudioElement; gain: GainNode | null; kind: 'audio' | null; trackId: string; fade: number }

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let eqNodes: BiquadFilterNode[] = []

function makeSlot(): Slot {
  const audio = new Audio()
  audio.crossOrigin = 'anonymous'
  audio.preload = 'auto'
  return { audio, gain: null, kind: null, trackId: '', fade: 1 }
}
const slots = [makeSlot(), makeSlot()]
let active = 0
const cur = () => slots[active]

function audioGraph() {
  if (ctx) return
  ctx = new AudioContext()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.8
  eqNodes = EQ_BANDS.map((f, i) => {
    const b = ctx!.createBiquadFilter()
    b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
    b.frequency.value = f
    b.Q.value = 1
    return b
  })
  for (let i = 1; i < eqNodes.length; i++) eqNodes[i - 1].connect(eqNodes[i])
  eqNodes[eqNodes.length - 1].connect(analyser)
  analyser.connect(ctx.destination)
  slots.forEach((s) => {
    s.gain = ctx!.createGain()
    ctx!.createMediaElementSource(s.audio).connect(s.gain)
    s.gain.connect(eqNodes[0])
  })
  applyEq()
}
function applyEq() { useSettings.get().eq.forEach((g, i) => eqNodes[i] && (eqNodes[i].gain.value = g)) }
useSettings.subscribe(applyEq)

export const getAnalyser = () => (cur().kind === 'audio' ? analyser : null)

const master = () => (usePlayer.get().muted ? 0 : useSettings.get().volume)
function applyVolume(s: Slot) {
  s.audio.volume = Math.max(0, Math.min(1, master() * s.fade))
}

/** Auto-gain for local files: steer RMS loudness toward a common target. YouTube already normalizes. */
function autoGain(t: Track) {
  const db = useLibrary.get().features[t.id]?.loudnessDb
  if (!useSettings.get().autoGain || db === undefined) return 1
  return Math.max(0.35, Math.min(2, 10 ** ((-16 - db) / 20)))
}

// ---------- resolving references to playable videos ----------
const badVideos = new Set<string>()
const resolving = new Map<string, Promise<Track>>()

export function resolveTrack(t: Track): Promise<Track> {
  if (t.source === 'local' || (t.videoId && !badVideos.has(t.videoId))) return Promise.resolve(t)
  if (resolving.has(t.id)) return resolving.get(t.id)!
  const p = (async () => {
    countYtSearch()
    const results = (await api.ytSearch(`${t.artist} ${t.title}`.trim(), 8)).filter((v) => !badVideos.has(v.id))
    const hit = bestMatch(results, t.title, t.artist, t.duration) ?? (!t.artist ? results[0] : null)
    if (!hit) throw new Error('nomatch')
    const resolved: Track = { ...t, videoId: hit.id, artwork: t.artwork ?? hit.thumb, duration: t.duration || hit.duration }
    remember([resolved])
    return resolved
  })().finally(() => resolving.delete(t.id))
  resolving.set(t.id, p)
  return p
}

// ---------- loading ----------
let loadSeq = 0
let failures = 0 // consecutive playback failures
async function loadInto(slot: Slot, t: Track, autoplay: boolean) {
  slot.trackId = t.id
  audioGraph()
  slot.kind = 'audio'
  slot.audio.src = fileSrc(t.path!)
  slot.gain!.gain.value = autoGain(t)
  applyVolume(slot)
  if (autoplay) { await ctx?.resume(); await slot.audio.play() }
}

/** Play a YouTube song in the YouTube Music window (it can stay minimized; Echo shows the cover). */
async function playRemote(t: Track, seq: number) {
  const r = await resolveTrack(t)
  if (seq !== loadSeq) return
  previous = expected; expected = r.videoId!; navAt = performance.now(); lastRemaining = 99
  driving = true
  useYtm.set({ active: true })
  ytmPos = 0; ytmAt = performance.now()
  await api.ytmOpen(`https://music.youtube.com/watch?v=${encodeURIComponent(r.videoId!)}&echo=1`, false)
  if (useSettings.get().volume !== 1) setTimeout(() => ytm('volume', master()), 2500)
}

async function start(t: Track) {
  const seq = ++loadSeq
  finishListen()
  const s = cur()
  s.fade = 1
  usePlayer.set({ loading: true, error: '' })
  useTime.set({ position: 0, duration: t.duration, buffered: 0 })
  try {
    if (t.source === 'local') {
      if (ytmActive()) { ytm('pause'); useYtm.set({ active: false }) }
      driving = false
      slots.forEach((x, i) => { if (i !== active) x.audio.pause() })
      await loadInto(s, t, true)
    } else {
      slots.forEach((x) => x.audio.pause())
      await playRemote(t, seq)
    }
    if (seq !== loadSeq) return
    begin(t)
  } catch (e) {
    console.warn('[echo] load failed', e)
    if (seq !== loadSeq) return
    // No YouTube API key: find the song in the YouTube Music window instead.
    if (String((e as Error).message ?? e).includes('youtube:nokey')) {
      driving = false
      api.ytmOpen(ytmSearchUrl(`${t.artist} ${t.title}`.trim()), true).catch(() => {})
      usePlayer.set({ loading: false, playing: false })
      return
    }
    usePlayer.set({ loading: false, playing: false, error: String((e as Error).message ?? e) })
    // Unplayable (no match / quota): move on rather than stall the queue.
    if ((e as Error).message === 'nomatch' && ++failures < 3) setTimeout(() => seq === loadSeq && next(true), 800)
  }
  prefetchNext()
}

// ---------- listening log (statistics, Music DNA) ----------
let listened = 0, listenTrack: Track | null = null
function begin(t: Track) {
  listenTrack = t
  listened = 0
  if (!useSettings.get().privateSession) library.pushHistory(t)
}
function finishListen() {
  const t = listenTrack
  if (!t || listened < 5 || useSettings.get().privateSession) { listenTrack = null; return }
  const f = useLibrary.get().features[t.id]
  api.playLog({ trackId: t.id, title: t.title, artist: t.artist, genre: f?.genre ?? t.genre, mood: f?.mood, seconds: listened }).catch(() => {})
  listenTrack = null
}
addEventListener('beforeunload', finishListen)

// ---------- transport ----------
export async function play() {
  if (ytmActive()) return ytm('play')
  const s = cur()
  if (s.kind === 'audio') { await ctx?.resume(); await s.audio.play().catch(() => {}) }
  else if (current()) start(current()!)
}
export function pause() { if (ytmActive()) return ytm('pause'); cur().audio.pause() }
export const toggle = () => (usePlayer.get().playing ? pause() : play())
export function seek(sec: number) {
  if (!Number.isFinite(sec)) return
  if (ytmActive()) { ytm('seek', Math.max(0, sec)); ytmPos = Math.max(0, sec); ytmAt = performance.now(); useTime.set({ position: ytmPos }); return }
  const s = cur()
  sec = Math.max(0, sec)
  if (s.kind === 'audio') s.audio.currentTime = sec
  useTime.set({ position: sec })
}
export const now = () => {
  if (ytmActive()) return ytmPos + (usePlayer.get().playing ? (performance.now() - ytmAt) / 1000 : 0)
  return cur().audio.currentTime
}

export function playQueue(tracks: Track[], startAt = 0) {
  const list = tracks.filter(playable)
  if (!list.length) return
  remember(list)
  const first = tracks[startAt] && playable(tracks[startAt]) ? tracks[startAt] : list[0]
  const { shuffle } = usePlayer.get()
  let queue = list, index = list.indexOf(first)
  if (shuffle) { queue = [first, ...shuffled(list.filter((t) => t !== first))]; index = 0 }
  usePlayer.set({ queue, original: list, index })
  start(first)
}
export function playAt(i: number) {
  const q = usePlayer.get().queue
  if (!q[i]) return
  usePlayer.set({ index: i })
  start(q[i])
}
export function next(auto = false) {
  if (ytmActive() && !driving) return ytm('next')
  const { index, queue, repeat, sleepAt } = usePlayer.get()
  if (auto && sleepAt === -1) { usePlayer.set({ sleepAt: 0 }); pause(); return }
  if (auto && repeat === 'one') { seek(0); play(); return }
  if (index + 1 < queue.length) return playAt(index + 1)
  if (repeat === 'all' && queue.length) return playAt(0)
  pause()
}
export function prev() {
  if (ytmActive() && !driving) return ytm('prev')
  if (now() > 3) return seek(0)
  const { index } = usePlayer.get()
  index > 0 ? playAt(index - 1) : seek(0)
}
export function setVolume(v: number) {
  useSettings.set({ volume: Math.max(0, Math.min(1, v)) })
  usePlayer.set({ muted: false })
  slots.forEach(applyVolume)
  if (ytmActive()) ytm('volume', master())
}
export function toggleMute() { usePlayer.set((s) => ({ muted: !s.muted })); slots.forEach(applyVolume); if (ytmActive()) ytm('volume', master()) }

function shuffled(ts: Track[]) {
  const s = useSettings.get(), lib = useLibrary.get()
  return smartShuffle(ts, { mode: s.shuffleMode, artistGap: s.artistGap, recent: lib.history, features: lib.features })
}
export function toggleShuffle() {
  const { shuffle, queue, index, original } = usePlayer.get()
  const nowT = queue[index]
  if (!shuffle) {
    const rest = queue.filter((_, i) => i !== index)
    usePlayer.set({ shuffle: true, original: queue, queue: nowT ? [nowT, ...shuffled(rest)] : shuffled(rest), index: nowT ? 0 : -1 })
  } else {
    const back = original.length ? original : queue
    usePlayer.set({ shuffle: false, queue: back, index: Math.max(0, back.findIndex((t) => t.id === nowT?.id)) })
  }
}
/** Re-shuffle what's left after the current track (used when the shuffle mode changes). */
export function reshuffleUpNext() {
  const { queue, index, shuffle } = usePlayer.get()
  if (!shuffle || index < 0) return
  usePlayer.set({ queue: [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1))] })
}
export const cycleRepeat = () => usePlayer.set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }))

export function enqueue(ts: Track[], nextUp = false) {
  const list = ts.filter(playable)
  if (!list.length) return
  remember(list)
  const wasEmpty = usePlayer.get().index < 0
  usePlayer.set((s) => {
    const q = [...s.queue]
    q.splice(nextUp ? s.index + 1 : q.length, 0, ...list)
    return { queue: q, original: [...s.original, ...list], index: wasEmpty ? 0 : s.index }
  })
  if (wasEmpty) start(list[0])
}
export function removeFromQueue(i: number) {
  usePlayer.set((s) => ({ queue: s.queue.filter((_, j) => j !== i), index: i < s.index ? s.index - 1 : s.index }))
}
export function moveInQueue(from: number, to: number) {
  usePlayer.set((s) => {
    const q = [...s.queue]; const [m] = q.splice(from, 1); q.splice(to, 0, m)
    return { queue: q, index: q.indexOf(s.queue[s.index]) }
  })
}
export const clearUpNext = () => usePlayer.set((s) => ({ queue: s.queue.slice(0, s.index + 1) }))
export const setSleep = (minutes: number) => usePlayer.set({ sleepAt: minutes > 0 ? Date.now() + minutes * 60000 : minutes })

function prefetchNext() {
  const { queue, index } = usePlayer.get()
  const n = queue[index + 1]
  if (n && n.source === 'ref') resolveTrack(n).then((r) => usePlayer.set((s) => ({ queue: s.queue.map((x) => (x.id === r.id ? r : x)) }))).catch(() => {})
}

// ---------- crossfade ----------
let fading = false
async function crossfade() {
  const { index, queue, repeat } = usePlayer.get()
  const ni = index + 1 < queue.length ? index + 1 : repeat === 'all' ? 0 : -1
  if (ni < 0 || repeat === 'one' || usePlayer.get().sleepAt === -1) return
  fading = true
  const out = cur(), inn = slots[1 - active], dur = useSettings.get().crossfade * 1000
  const t = queue[ni]
  try {
    inn.fade = 0
    await loadInto(inn, t, true)
  } catch { fading = false; return }
  finishListen()
  active = 1 - active
  usePlayer.set({ index: ni })
  begin(t)
  prefetchNext()
  const t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur)
    inn.fade = Math.sin((k * Math.PI) / 2) // equal-power curve: no loudness dip mid-fade
    out.fade = Math.cos((k * Math.PI) / 2)
    applyVolume(inn); applyVolume(out)
    if (k < 1) requestAnimationFrame(step)
    else { out.audio.pause(); fading = false }
  }
  step()
}

// ---------- events ----------
slots.forEach((s) => {
  const mine = () => s === cur()
  s.audio.addEventListener('playing', () => mine() && usePlayer.set({ playing: true, loading: false }))
  s.audio.addEventListener('pause', () => mine() && usePlayer.set({ playing: false }))
  s.audio.addEventListener('waiting', () => mine() && usePlayer.set({ loading: true }))
  s.audio.addEventListener('ended', () => mine() && !fading && next(true))
  s.audio.addEventListener('error', () => mine() && s.kind === 'audio' && usePlayer.set({ error: 'playback', playing: false, loading: false }))
})

// One clock for both kinds: progress, listen time, crossfade trigger, sleep timer.
let lastTick = performance.now()
setInterval(() => {
  const s = cur(), nowMs = performance.now()
  const dt = (nowMs - lastTick) / 1000
  lastTick = nowMs
  if (ytmActive()) {
    const { playing, sleepAt } = usePlayer.get()
    if (playing && dt < 2) listened += dt
    if (sleepAt > 0 && Date.now() >= sleepAt) { usePlayer.set({ sleepAt: 0 }); pause() }
    return
  }
  if (!s.kind) return
  const pos = s.audio.currentTime
  const dur = s.audio.duration || useTime.get().duration
  const buf = s.audio.buffered.length ? s.audio.buffered.end(s.audio.buffered.length - 1) : 0
  useTime.set({ position: pos, duration: dur, buffered: buf })
  const { playing, sleepAt } = usePlayer.get()
  if (playing && dt < 2) listened += dt
  if (sleepAt > 0 && Date.now() >= sleepAt) { usePlayer.set({ sleepAt: 0 }); pause() }
  const cf = useSettings.get().crossfade
  const { nextLocal, sameAlbum } = (() => { const q = usePlayer.get(); const a = q.queue[q.index], b = q.queue[q.index + 1]; return { nextLocal: b?.source === 'local', sameAlbum: !!a?.album && a.album === b?.album } })()
  if (playing && cf > 0 && !fading && dur > cf * 3 && dur - pos <= cf && !sameAlbum && nextLocal) crossfade() // crossfade between local files
}, 250)

// ---------- OS media controls ----------
const ms = navigator.mediaSession
if (ms) {
  ms.setActionHandler('play', () => play())
  ms.setActionHandler('pause', () => pause())
  ms.setActionHandler('previoustrack', () => prev())
  ms.setActionHandler('nexttrack', () => next())
}
let lastId = ''
usePlayer.subscribe(() => {
  const t = current()
  if (ms && t && t.id !== lastId) ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album ?? '', artwork: t.artwork ? [{ src: t.artwork }] : [] })
  if (ms) ms.playbackState = usePlayer.get().playing ? 'playing' : 'paused'
  lastId = t?.id ?? ''
})
