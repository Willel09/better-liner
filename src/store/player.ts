// Playback engine. Two slots (A/B) so the next song can start before the current one ends (crossfade).
// Each slot plays either a YouTube video (official embedded player) or a local file (<audio> + Web Audio).
import { api, fileSrc } from '../lib/api'
import { bestMatch } from '../lib/match'
import { smartShuffle } from '../lib/shuffle'
import type { Track } from '../lib/types'
import { YtDeck } from '../lib/ytplayer'
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
export const current = () => usePlayer.get().queue[usePlayer.get().index] ?? null

// ---------- slots ----------
type Kind = 'yt' | 'audio' | null
type Slot = { host: HTMLDivElement; yt: YtDeck | null; audio: HTMLAudioElement; gain: GainNode | null; kind: Kind; trackId: string; fade: number }

export const stage = document.createElement('div') // positioned over a placeholder by <VideoStage/>
stage.className = 'video-stage'
document.body.appendChild(stage)

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let eqNodes: BiquadFilterNode[] = []

function makeSlot(): Slot {
  const host = document.createElement('div')
  host.className = 'video-slot'
  stage.appendChild(host)
  const audio = new Audio()
  audio.crossOrigin = 'anonymous'
  audio.preload = 'auto'
  return { host, yt: null, audio, gain: null, kind: null, trackId: '', fade: 1 }
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
  const v = master() * s.fade
  if (s.kind === 'yt') s.yt?.setVolume(v)
  else s.audio.volume = Math.max(0, Math.min(1, v))
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
  if (t.source === 'local') {
    audioGraph()
    if (slot.kind === 'yt') slot.yt?.stop()
    slot.kind = 'audio'
    slot.audio.src = fileSrc(t.path!)
    slot.gain!.gain.value = autoGain(t)
    applyVolume(slot)
    if (autoplay) { await ctx?.resume(); await slot.audio.play() }
  } else {
    const r = await resolveTrack(t)
    if (slot.trackId !== t.id) return
    slot.audio.pause()
    slot.kind = 'yt'
    slot.yt ??= new YtDeck(slot.host, ytEvents(slot))
    await slot.yt.load(r.videoId!, 0, autoplay)
    applyVolume(slot)
  }
  slot.host.dataset.kind = slot.kind ?? ''
}

async function start(t: Track) {
  const seq = ++loadSeq
  finishListen()
  const s = cur()
  s.fade = 1
  slots.forEach((x, i) => { if (i !== active) { x.audio.pause(); x.yt?.pause() } })
  usePlayer.set({ loading: true, error: '' })
  useTime.set({ position: 0, duration: t.duration, buffered: 0 })
  try {
    await loadInto(s, t, true)
    if (seq !== loadSeq) return
    begin(t)
  } catch (e) {
    console.warn('[lumen] load failed', e)
    if (seq !== loadSeq) return
    usePlayer.set({ loading: false, playing: false, error: String((e as Error).message ?? e) })
    // Unplayable (no match / quota): move on rather than stall the queue.
    if ((e as Error).message === 'nomatch' && ++failures < 3) setTimeout(() => seq === loadSeq && next(true), 800)
  }
  markActive()
  prefetchNext()
}

function markActive() { slots.forEach((x, i) => x.host.classList.toggle('on', i === active)) }

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
  const s = cur()
  if (s.kind === 'audio') { await ctx?.resume(); await s.audio.play().catch(() => {}) }
  else if (s.kind === 'yt') s.yt?.play()
  else if (current()) start(current()!)
}
export function pause() { const s = cur(); s.kind === 'audio' ? s.audio.pause() : s.yt?.pause() }
export const toggle = () => (usePlayer.get().playing ? pause() : play())
export function seek(sec: number) {
  const s = cur()
  if (!Number.isFinite(sec)) return
  sec = Math.max(0, sec)
  s.kind === 'audio' ? (s.audio.currentTime = sec) : s.yt?.seek(sec)
  useTime.set({ position: sec })
}
export const now = () => { const s = cur(); return s.kind === 'audio' ? s.audio.currentTime : s.yt?.time() ?? 0 }

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
  const { index, queue, repeat, sleepAt } = usePlayer.get()
  if (auto && sleepAt === -1) { usePlayer.set({ sleepAt: 0 }); pause(); return }
  if (auto && repeat === 'one') { seek(0); play(); return }
  if (index + 1 < queue.length) return playAt(index + 1)
  if (repeat === 'all' && queue.length) return playAt(0)
  pause()
}
export function prev() {
  if (now() > 3) return seek(0)
  const { index } = usePlayer.get()
  index > 0 ? playAt(index - 1) : seek(0)
}
export function setVolume(v: number) {
  useSettings.set({ volume: Math.max(0, Math.min(1, v)) })
  usePlayer.set({ muted: false })
  slots.forEach(applyVolume)
}
export function toggleMute() { usePlayer.set((s) => ({ muted: !s.muted })); slots.forEach(applyVolume) }

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
  markActive()
  prefetchNext()
  const t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / dur)
    inn.fade = Math.sin((k * Math.PI) / 2) // equal-power curve: no loudness dip mid-fade
    out.fade = Math.cos((k * Math.PI) / 2)
    applyVolume(inn); applyVolume(out)
    if (k < 1) requestAnimationFrame(step)
    else { out.kind === 'audio' ? out.audio.pause() : out.yt?.pause(); fading = false }
  }
  step()
}

// ---------- events ----------
function ytEvents(slot: Slot) {
  return {
    onState(st: 'playing' | 'paused' | 'ended' | 'buffering') {
      if (slot !== cur()) return
      if (st === 'playing') { failures = 0; usePlayer.set({ playing: true, loading: false }) }
      if (st === 'paused') usePlayer.set({ playing: false })
      if (st === 'buffering') usePlayer.set({ loading: true })
      if (st === 'ended' && !fading) next(true)
    },
    onError(code: number) {
      console.warn('[lumen] youtube player error', code)
      if (slot !== cur()) return
      const t = current()
      // 100: removed, 101/150: owner blocked embedding → try the next best match once.
      if (t?.videoId && [100, 101, 150].includes(code)) {
        badVideos.add(t.videoId)
        if (t.source === 'ref') { start(t); return }
      }
      usePlayer.set({ error: `youtube:${code}`, playing: false, loading: false })
      // Skip unplayable songs, but stop after 3 failures in a row instead of racing through the queue.
      if (++failures < 3) setTimeout(() => next(true), 1000)
    },
  }
}

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
  if (!s.kind) return
  const pos = s.kind === 'audio' ? s.audio.currentTime : s.yt!.time()
  const dur = (s.kind === 'audio' ? s.audio.duration : s.yt!.duration()) || useTime.get().duration
  const buf = s.kind === 'audio' ? (s.audio.buffered.length ? s.audio.buffered.end(s.audio.buffered.length - 1) : 0) : s.yt!.buffered()
  useTime.set({ position: pos, duration: dur, buffered: buf })
  const { playing, sleepAt } = usePlayer.get()
  if (playing && dt < 2) listened += dt
  if (sleepAt > 0 && Date.now() >= sleepAt) { usePlayer.set({ sleepAt: 0 }); pause() }
  const cf = useSettings.get().crossfade
  const sameAlbum = (() => { const q = usePlayer.get(); const a = q.queue[q.index], b = q.queue[q.index + 1]; return !!a?.album && a.album === b?.album })()
  if (playing && cf > 0 && !fading && dur > cf * 3 && dur - pos <= cf && !sameAlbum) crossfade()
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
