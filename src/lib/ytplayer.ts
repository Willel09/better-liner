// Official YouTube IFrame Player API. The player stays visible (≥200×200) as required by YouTube's terms;
// Lumen only drives it through the public API (load/play/pause/seek/volume).
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<void> | null = null
function loadApi() {
  if (apiReady) return apiReady
  apiReady = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve()
    window.onYouTubeIframeAPIReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => { apiReady = null; reject(new Error('youtube:offline')) }
    document.head.appendChild(s)
  })
  return apiReady
}

export type YtEvents = { onState(s: 'playing' | 'paused' | 'ended' | 'buffering'): void; onError(code: number): void }

export class YtDeck {
  private player: any = null
  private ready: Promise<void>
  constructor(host: HTMLElement, ev: YtEvents) {
    const el = document.createElement('div')
    host.appendChild(el)
    this.ready = loadApi().then(() => new Promise<void>((resolve) => {
      this.player = new window.YT.Player(el, {
        width: '100%', height: '100%',
        playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
        events: {
          onReady: () => resolve(),
          onStateChange: (e: any) => {
            const m: Record<number, 'playing' | 'paused' | 'ended' | 'buffering'> = { 1: 'playing', 2: 'paused', 0: 'ended', 3: 'buffering' }
            if (m[e.data]) ev.onState(m[e.data])
          },
          onError: (e: any) => ev.onError(e.data),
        },
      })
    }))
  }
  async load(videoId: string, start = 0, autoplay = true) {
    await this.ready
    if (autoplay) this.player.loadVideoById({ videoId, startSeconds: start })
    else this.player.cueVideoById({ videoId, startSeconds: start })
  }
  play() { this.player?.playVideo() }
  pause() { this.player?.pauseVideo() }
  stop() { this.player?.stopVideo?.() }
  seek(s: number) { this.player?.seekTo(s, true) }
  setVolume(v: number) { this.player?.setVolume?.(Math.round(Math.max(0, Math.min(1, v)) * 100)) }
  time(): number { return this.player?.getCurrentTime?.() ?? 0 }
  duration(): number { return this.player?.getDuration?.() ?? 0 }
  buffered(): number { return (this.player?.getVideoLoadedFraction?.() ?? 0) * this.duration() }
}
