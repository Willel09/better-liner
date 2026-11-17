// Playback engine: two <audio> decks (for crossfade) routed through Web Audio for visuals + normalization.
import { streamUrl } from '../lib/audius'
import type { Track } from '../lib/types'
import { create } from './create'
import { library, useLibrary } from './library'
import { useSettings } from './settings'

export type Repeat = 'off' | 'all' | 'one'

export const usePlayer = create({
  queue: [] as Track[],
  original: [] as Track[], // order before shuffle
  index: -1,
  playing: false,
  loading: false,
  error: '' as string,
  shuffle: false,
  repeat: 'off' as Repeat,
  panel: null as null | 'queue' | 'lyrics',
  fullscreen: false,
  muted: false,
}, undefined)

// Time lives in its own store so 4 Hz updates don't re-render the whole app.
export const useTime = create({ position: 0, duration: 0, buffered: 0 })

const decks = [new Audio(), new Audio()]
decks.forEach((a) => { a.crossOrigin = 'anonymous'; a.preload = 'auto' })
let active = 0
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let compressor: DynamicsCompressorNode | null = null
let fading = false

const cur = () => decks[active]
export const current = () => usePlayer.get().queue[usePlayer.get().index] ?? null

function graph() {
  if (ctx) return
  ctx = new AudioContext()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.82
  compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.ratio.value = 4
  const bus = ctx.createGain()
  decks.forEach((a) => ctx!.createMediaElementSource(a).connect(bus))
  bus.connect(analyser)
  applyNormalize()
}

function applyNormalize() {
  if (!ctx || !analyser || !compressor) return
  analyser.disconnect(); compressor.disconnect()
  if (useSettings.get().normalize) { analyser.connect(compressor); compressor.connect(ctx.destination) }
  else analyser.connect(ctx.destination)
}
useSettings.subscribe(applyNormalize)

export function getAnalyser() { return analyser }
export const now = () => cur().currentTime // precise time for word-level lyric sync

const srcFor = (t: Track) => useLibrary.get().downloads[t.id] ?? t.url ?? streamUrl(t.id)
const vol = () => (usePlayer.get().muted ? 0 : useSettings.get().volume)

async function load(t: Track, autoplay = true) {
  graph()
  const a = cur()
  usePlayer.set({ loading: true, error: '' })
  a.src = srcFor(t)
  a.volume = vol()
  useTime.set({ position: 0, duration: t.duration, buffered: 0 })
  library.pushHistory(t)
  if (autoplay) await play()
}

export async function play() {
  if (!cur().src) return
  await ctx?.resume()
  try { await cur().play() } catch (e: any) { if (e?.name !== 'AbortError') usePlayer.set({ error: String(e?.message ?? e), loading: false }) }
}
export const pause = () => cur().pause()
export const toggle = () => (cur().paused ? play() : pause())

export function playQueue(tracks: Track[], start = 0) {
  if (!tracks.length) return
  library.remember(tracks)
  const s = usePlayer.get()
  let queue = [...tracks], index = start
  if (s.shuffle) {
    const first = queue.splice(start, 1)[0]
    queue = [first, ...shuffled(queue)]; index = 0
  }
  usePlayer.set({ queue, original: tracks, index })
  load(queue[index])
}

export function playAt(index: number) {
  const q = usePlayer.get().queue
  if (!q[index]) return
  usePlayer.set({ index })
  load(q[index])
}

export function next(auto = false) {
  const { index, queue, repeat } = usePlayer.get()
  if (auto && repeat === 'one') { cur().currentTime = 0; return play() }
  if (index + 1 < queue.length) return playAt(index + 1)
  if (repeat === 'all' && queue.length) return playAt(0)
  pause()
}

export function prev() {
  if (cur().currentTime > 3) { cur().currentTime = 0; return }
  const { index } = usePlayer.get()
  if (index > 0) playAt(index - 1)
  else cur().currentTime = 0
}

export function seek(sec: number) {
  const a = cur()
  if (Number.isFinite(sec)) a.currentTime = Math.max(0, Math.min(sec, a.duration || sec))
}

export function setVolume(v: number) {
  useSettings.set({ volume: Math.max(0, Math.min(1, v)) })
  usePlayer.set({ muted: false })
  cur().volume = vol()
}
export function toggleMute() {
  usePlayer.set((s) => ({ muted: !s.muted }))
  cur().volume = vol()
}

function shuffled<T>(xs: T[]) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function toggleShuffle() {
  const { shuffle, queue, index, original } = usePlayer.get()
  const now = queue[index]
  if (!shuffle) {
    const rest = queue.filter((_, i) => i !== index)
    usePlayer.set({ shuffle: true, original: queue, queue: now ? [now, ...shuffled(rest)] : shuffled(rest), index: now ? 0 : -1 })
  } else {
    const back = original.length ? original : queue
    usePlayer.set({ shuffle: false, queue: back, index: Math.max(0, back.findIndex((t) => t.id === now?.id)) })
  }
}

export const cycleRepeat = () => usePlayer.set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' }))

export function enqueue(t: Track, nextUp = false) {
  library.remember([t])
  usePlayer.set((s) => {
    if (s.index < 0) return { queue: [t], original: [t], index: -1 }
    const q = [...s.queue]
    q.splice(nextUp ? s.index + 1 : q.length, 0, t)
    return { queue: q, original: [...s.original, t] }
  })
  if (usePlayer.get().index < 0) playAt(0)
}

export function removeFromQueue(i: number) {
  usePlayer.set((s) => ({ queue: s.queue.filter((_, j) => j !== i), index: i < s.index ? s.index - 1 : s.index }))
}

export function moveInQueue(from: number, to: number) {
  usePlayer.set((s) => {
    const q = [...s.queue]; const [m] = q.splice(from, 1); q.splice(to, 0, m)
    const playing = s.queue[s.index]
    return { queue: q, index: q.indexOf(playing) }
  })
}

export const clearUpNext = () => usePlayer.set((s) => ({ queue: s.queue.slice(0, s.index + 1) }))
export const setPanel = (p: 'queue' | 'lyrics') => usePlayer.set((s) => ({ panel: s.panel === p ? null : p }))
export const setFullscreen = (on: boolean) => { usePlayer.set({ fullscreen: on }); window.lumen?.setFullscreen(on) }

// ---------- deck events ----------
function crossfadeTo() {
  const { index, queue, repeat } = usePlayer.get()
  const nextIdx = index + 1 < queue.length ? index + 1 : repeat === 'all' ? 0 : -1
  if (nextIdx < 0 || repeat === 'one') return
  fading = true
  const out = cur(), dur = useSettings.get().crossfade
  active = 1 - active
  usePlayer.set({ index: nextIdx })
  load(queue[nextIdx]).then(() => {
    const inn = cur(), start = performance.now(), v = vol()
    inn.volume = 0
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (dur * 1000))
      inn.volume = v * k; out.volume = v * (1 - k)
      if (k < 1) requestAnimationFrame(step)
      else { out.pause(); out.removeAttribute('src'); out.load(); fading = false }
    }
    step()
  })
}

decks.forEach((a) => {
  const mine = () => a === cur()
  a.addEventListener('playing', () => mine() && usePlayer.set({ playing: true, loading: false }))
  a.addEventListener('pause', () => mine() && usePlayer.set({ playing: false }))
  a.addEventListener('waiting', () => mine() && usePlayer.set({ loading: true }))
  a.addEventListener('ended', () => mine() && next(true))
  a.addEventListener('error', () => {
    if (!mine() || !a.src) return
    usePlayer.set({ loading: false, playing: false, error: navigator.onLine ? 'playback' : 'offline' })
  })
  a.addEventListener('loadedmetadata', () => mine() && useTime.set({ duration: a.duration }))
  a.addEventListener('timeupdate', () => {
    if (!mine()) return
    const b = a.buffered.length ? a.buffered.end(a.buffered.length - 1) : 0
    useTime.set({ position: a.currentTime, duration: a.duration || useTime.get().duration, buffered: b })
    const cf = useSettings.get().crossfade
    if (cf > 0 && !fading && a.duration && a.duration - a.currentTime <= cf && a.duration > cf * 2) crossfadeTo()
  })
})

// ---------- OS integration: Media Session (media keys, MPRIS, Now Playing) ----------
const ms = navigator.mediaSession
if (ms) {
  ms.setActionHandler('play', () => play())
  ms.setActionHandler('pause', () => pause())
  ms.setActionHandler('previoustrack', () => prev())
  ms.setActionHandler('nexttrack', () => next())
  ms.setActionHandler('seekto', (d) => seek(d.seekTime ?? 0))
}

let lastId = ''
usePlayer.subscribe(() => {
  const t = current(), s = usePlayer.get()
  if (ms && t && t.id !== lastId) {
    ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album ?? '', artwork: t.artwork ? [{ src: t.artwork, sizes: '480x480' }] : [] })
  }
  if (ms) ms.playbackState = s.playing ? 'playing' : 'paused'
  lastId = t?.id ?? ''
})
