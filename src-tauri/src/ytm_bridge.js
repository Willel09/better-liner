// Injected into the YouTube Music window. Reads what the (logged-in) site is playing from the
// standard Media Session API and the <video> element, and lets Echo press play/pause/next/prev.
// It can only report state (ytm_state) and listen for "ytm:command" events — nothing else in Echo.
(() => {
  if (location.hostname !== 'music.youtube.com' || window.__echoYtm) return
  const T = window.__TAURI_INTERNALS__
  if (!T) return
  window.__echoYtm = true
  const video = () => document.querySelector('video')
  const click = (sel) => document.querySelector(sel)?.click()
  let last = ''

  // Echo opened this song (…&echo=1): start it even if the window is in the background.
  if (new URLSearchParams(location.search).get('echo') === '1') {
    let tries = 0
    const t = setInterval(() => {
      const v = video()
      if (v && !v.paused && v.currentTime > 0) return clearInterval(t)
      if (v) v.play().catch(() => {})
      if (++tries > 30) clearInterval(t)
    }, 500)
  }

  setInterval(() => {
    const md = navigator.mediaSession && navigator.mediaSession.metadata
    const v = video()
    if (!md || !v || !md.title) return
    const art = (md.artwork || []).slice(-1)[0]
    const s = {
      id: new URLSearchParams(location.search).get('v') || '',
      title: md.title || '', artist: md.artist || '', album: md.album || '',
      artwork: (art && art.src) || '',
      playing: !v.paused, position: v.currentTime || 0, duration: Number.isFinite(v.duration) ? v.duration : 0,
    }
    const key = JSON.stringify([s.id, s.title, s.playing, Math.floor(s.position)])
    if (key === last) return
    last = key
    T.invoke('ytm_state', { state: s }).catch(() => {})
  }, 500)

  const run = ({ cmd, arg }) => {
    const v = video()
    if (cmd === 'toggle' && v) v.paused ? v.play() : v.pause()
    else if (cmd === 'play' && v) v.play()
    else if (cmd === 'pause' && v) v.pause()
    else if (cmd === 'next') click('ytmusic-player-bar .next-button')
    else if (cmd === 'prev') click('ytmusic-player-bar .previous-button')
    else if (cmd === 'seek' && v) v.currentTime = Math.max(0, Number(arg) || 0)
    else if (cmd === 'volume' && v) v.volume = Math.max(0, Math.min(1, Number(arg)))
  }
  // Same call @tauri-apps/api's listen() makes; this page doesn't bundle the API package.
  T.invoke('plugin:event|listen', {
    event: 'ytm:command',
    target: { kind: 'Any' },
    handler: T.transformCallback((e) => run(e.payload || {})),
  }).catch(() => {})
})()
