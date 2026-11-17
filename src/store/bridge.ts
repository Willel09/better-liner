// Connects the player to the outside: mini player window, Discord, keyboard shortcuts, Smart Radio.
import { api, emit, listen } from '../lib/api'
import { similarTo } from '../lib/ai'
import { current, cycleRepeat, enqueue, next, pause, play, prev, seek, setVolume, toggle, toggleMute, toggleShuffle, usePlayer, useTime } from './player'
import { library, playable, useLibrary } from './library'
import { useSettings } from './settings'
import { back, navigate } from './router'
import { create } from './create'

export const useMini = create({ open: false })

export function startBridge() {
  // ---- mini player (separate always-on-top window) ----
  let lastSent = 0
  const broadcast = (force = false) => {
    const n = performance.now()
    if (!force && n - lastSent < 400) return
    lastSent = n
    const t = current(), s = usePlayer.get(), tm = useTime.get()
    emit('player:state', { track: t, playing: s.playing, position: tm.position, duration: tm.duration, liked: t ? library.isLiked(t.id) : false })
  }
  usePlayer.subscribe(() => broadcast(true))
  useLibrary.subscribe(() => broadcast(true))
  useTime.subscribe(() => broadcast())
  listen<string>('player:command', (c) => {
    if (c === 'toggle') toggle()
    else if (c === 'next') next()
    else if (c === 'prev') prev()
    else if (c === 'like') { const t = current(); if (t) library.toggleLike(t) }
    else if (c === 'hello') broadcast(true)
  })
  listen<boolean>('mini:open', (open) => useMini.set({ open }))

  // ---- Discord Rich Presence ----
  let key = ''
  const presence = () => {
    const t = current(), s = usePlayer.get(), id = useSettings.get().discordId.trim()
    const pos = useTime.get().position, dur = useTime.get().duration
    const k = `${id}|${t?.id}|${s.playing}|${Math.floor(pos / 20)}`
    if (k === key || useSettings.get().privateSession) return
    key = k
    const nowS = Math.floor(Date.now() / 1000)
    api.discord(id, t && s.playing ? { title: t.title, artist: t.artist, start: nowS - Math.floor(pos), end: dur ? nowS + Math.floor(dur - pos) : undefined } : undefined)
  }
  usePlayer.subscribe(presence)
  useSettings.subscribe(presence)

  // ---- Smart Radio: keep the music going with similar songs ----
  let radioFor = ''
  usePlayer.subscribe(async () => {
    const s = usePlayer.get(), t = current()
    if (!t || !useSettings.get().smartRadio || s.repeat !== 'off' || s.radioBusy) return
    if (s.queue.length - s.index > 2 || radioFor === t.id) return
    radioFor = t.id
    usePlayer.set({ radioBusy: true })
    try {
      const have = new Set(s.queue.map((x) => x.id))
      const recent = new Set(useLibrary.get().history.slice(0, 40))
      const recs = (await similarTo(t, 10)).filter((x) => !have.has(x.id) && !recent.has(x.id) && playable(x))
      enqueue(recs)
    } catch { /* no AI key or request failed: radio simply doesn't extend */ }
    usePlayer.set({ radioBusy: false })
  })

  // ---- keyboard ----
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
    const mod = e.metaKey || e.ctrlKey
    const map: Record<string, () => unknown> = {
      ' ': toggle,
      ArrowRight: () => (mod ? next() : seek(useTime.get().position + 5)),
      ArrowLeft: () => (mod ? prev() : seek(useTime.get().position - 5)),
      ArrowUp: () => setVolume(useSettings.get().volume + 0.05),
      ArrowDown: () => setVolume(useSettings.get().volume - 0.05),
      m: toggleMute, s: toggleShuffle, r: cycleRepeat,
      n: () => navigate({ name: 'now' }),
      k: () => mod && navigate({ name: 'search' }),
      '/': () => navigate({ name: 'search' }),
      '[': () => mod && back(),
      p: () => (usePlayer.get().playing ? pause() : play()),
    }
    const fn = map[e.key]
    if (fn) { e.preventDefault(); fn() }
  })
}

export const SHORTCUTS: [string, string, string][] = [
  ['Space', 'Spela / pausa', 'Play / pause'], ['← / →', 'Spola 5 s', 'Seek 5 s'], ['⌘/Ctrl + ← / →', 'Föregående / nästa', 'Previous / next'],
  ['↑ / ↓', 'Volym', 'Volume'], ['M', 'Ljud av', 'Mute'], ['S', 'Blanda', 'Shuffle'], ['R', 'Upprepa', 'Repeat'],
  ['N', 'Spelas nu', 'Now Playing'], ['⌘/Ctrl + K eller /', 'Sök', 'Search'],
]
