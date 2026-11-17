// Wires the player to the main process: overlay window, Discord presence, Touch Bar, deep links, keyboard shortcuts.
import { audius } from '../lib/audius'
import { current, cycleRepeat, next, pause, play, playQueue, prev, seek, setFullscreen, setPanel, setVolume, toggle, toggleMute, toggleShuffle, usePlayer, useTime } from './player'
import { library } from './library'
import { useSettings } from './settings'
import { navigate } from './router'

const api = window.lumen

export function startBridge() {
  // Throttled state broadcast for the overlay mini player + Touch Bar.
  let lastSent = 0
  const broadcast = () => {
    const now = performance.now()
    if (now - lastSent < 250) return
    lastSent = now
    const t = current(), s = usePlayer.get(), tm = useTime.get()
    api?.sendState({ track: t, playing: s.playing, position: tm.position, duration: tm.duration, liked: t ? library.isLiked(t.id) : false })
  }
  usePlayer.subscribe(() => { lastSent = 0; broadcast() })
  useTime.subscribe(broadcast)

  // Discord: update on track/play-state/setting change, plus after seeks.
  let key = ''
  const presence = () => {
    const t = current(), s = usePlayer.get(), id = useSettings.get().discordId.trim()
    const pos = Math.floor(useTime.get().position)
    const k = `${id}|${t?.id}|${s.playing}|${Math.floor(pos / 15)}`
    if (k === key) return
    key = k
    api?.discord(id, t ? { title: t.title, artist: t.artist, artwork: t.artwork, duration: useTime.get().duration, position: pos, paused: !s.playing } : null)
  }
  usePlayer.subscribe(presence)
  useSettings.subscribe(presence)
  useTime.subscribe(presence)

  api?.onCommand((c) => {
    const actions: Record<string, () => unknown> = {
      toggle, play, pause, next: () => next(), prev, like: () => { const t = current(); if (t) library.toggleLike(t) },
      focus: () => setFullscreen(false),
    }
    if (c.startsWith('seek:')) seek(+c.slice(5))
    else actions[c]?.()
  })

  // lumen://track/<id>  lumen://artist/<id>  lumen://album/<id>  lumen://search/<q>
  api?.onDeepLink(async (url) => {
    const [kind, ...rest] = url.replace('lumen://', '').split('/')
    const id = decodeURIComponent(rest.join('/'))
    if (kind === 'track') playQueue([await audius.track(id)])
    else if (kind === 'artist') navigate({ name: 'artist', id })
    else if (kind === 'album') navigate({ name: 'album', id })
    else if (kind === 'search') navigate({ name: 'search', q: id })
  })

  window.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement
    if (el.closest('input, textarea, [contenteditable]')) return
    const mod = e.metaKey || e.ctrlKey
    const map: Record<string, () => unknown> = {
      ' ': toggle,
      ArrowRight: () => (mod ? next() : seek(useTime.get().position + 5)),
      ArrowLeft: () => (mod ? prev() : seek(useTime.get().position - 5)),
      ArrowUp: () => setVolume(useSettings.get().volume + 0.05),
      ArrowDown: () => setVolume(useSettings.get().volume - 0.05),
      m: toggleMute, s: toggleShuffle, r: cycleRepeat, l: () => setPanel('lyrics'), q: () => setPanel('queue'),
      f: () => setFullscreen(!usePlayer.get().fullscreen),
      Escape: () => usePlayer.get().fullscreen && setFullscreen(false),
      k: () => mod && navigate({ name: 'search' }),
      '/': () => navigate({ name: 'search' }),
    }
    const fn = map[e.key]
    if (fn) { e.preventDefault(); fn() }
  })
}

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'], ['← / →', 'Seek 5 s'], ['⌘/Ctrl + ← / →', 'Previous / next'], ['↑ / ↓', 'Volume'],
  ['M', 'Mute'], ['S', 'Shuffle'], ['R', 'Repeat'], ['L', 'Lyrics'], ['Q', 'Queue'], ['F', 'Full screen'], ['⌘/Ctrl + K or /', 'Search'],
]
