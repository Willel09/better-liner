import { YoutubeLogo, Books, CaretLeft, CaretRight, ChartBar, Compass, Disc, GearSix, Heart, House, MicrophoneStage, MusicNotes, Playlist as PlaylistIcon, Sparkle, Waveform } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { api, isTauri } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Route } from '../lib/types'
import { useLibrary } from '../store/library'
import { current, usePlayer, useYtm } from '../store/player'
import { back, forward, navigate, useRouter } from '../store/router'
import { useSettings } from '../store/settings'
import { Img } from './ui'

function Item({ to, icon, label, cur }: { to: Route; icon: ReactNode; label: string; cur: Route }) {
  const active = JSON.stringify(cur) === JSON.stringify(to)
  return <button className="side-item" aria-current={active ? 'page' : undefined} onClick={() => navigate(to)}>{icon}<span>{label}</span></button>
}

export function Sidebar() {
  const t = useT()
  const { stack, pos } = useRouter()
  const cur = stack[pos]
  const playlists = useLibrary((s) => s.playlists)
  const tracks = useLibrary((s) => s.tracks)
  const priv = useSettings((s) => s.privateSession)
  usePlayer((s) => s.index)
  const np = current()
  const ytmOpen = useYtm((s) => s.open)
  const ic = { size: 19 }

  return (
    <aside className="sidebar glass drag" aria-label="Sidebar">
      <div style={{ position: 'absolute', top: 12, right: 10, display: 'flex' }}>
        <button className="icon-btn sm" aria-label={t.back} disabled={pos === 0} onClick={back}><CaretLeft size={16} weight="bold" /></button>
        <button className="icon-btn sm" aria-label={t.forward} disabled={pos >= stack.length - 1} onClick={forward}><CaretRight size={16} weight="bold" /></button>
      </div>
      <nav className="no-drag" aria-label="Main">
        <Item cur={cur} to={{ name: 'home' }} icon={<House {...ic} />} label={t.home} />
        <Item cur={cur} to={{ name: 'discover' }} icon={<Compass {...ic} />} label={t.discover} />
        <Item cur={cur} to={{ name: 'now' }} icon={<Waveform {...ic} />} label={t.now} />
        <Item cur={cur} to={{ name: 'studio' }} icon={<Sparkle {...ic} />} label={t.studio} />
        {isTauri && <button className="side-item" aria-pressed={ytmOpen} onClick={() => api.ytmOpen()}><YoutubeLogo {...ic} weight={ytmOpen ? 'fill' : 'regular'} /><span>{t.ytm}</span></button>}
      </nav>
      <div className="side-label">{t.yourMusic}</div>
      <nav className="no-drag" aria-label={t.yourMusic}>
        <Item cur={cur} to={{ name: 'library' }} icon={<Books {...ic} />} label={t.library} />
        <Item cur={cur} to={{ name: 'playlists' }} icon={<PlaylistIcon {...ic} />} label={t.playlists} />
        <Item cur={cur} to={{ name: 'artists' }} icon={<MicrophoneStage {...ic} />} label={t.artists} />
        <Item cur={cur} to={{ name: 'albums' }} icon={<Disc {...ic} />} label={t.albums} />
        <Item cur={cur} to={{ name: 'liked' }} icon={<Heart {...ic} />} label={t.liked} />
        <Item cur={cur} to={{ name: 'stats' }} icon={<ChartBar {...ic} />} label={t.stats} />
      </nav>
      <div className="side-scroll no-drag">
        {playlists.slice(0, 30).map((p) => (
          <Item key={p.id} cur={cur} to={{ name: 'playlist', id: p.id }} label={p.name}
            icon={<span className="thumb">{p.trackIds[0] ? <Img src={tracks[p.trackIds[0]]?.artwork} alt="" /> : <MusicNotes size={14} />}</span>} />
        ))}
      </div>
      {/* The YouTube player docks here (≥200×200, always visible while a YouTube track plays). */}
      {np && cur.name !== 'now' && (
        <div className="tile-slot no-drag" data-video-slot="tile" onClick={() => navigate({ name: 'now' })} role="button" aria-label={t.now} tabIndex={0}>
          {(np.source === 'local' || np.source === 'ytm') && <Img src={np.artwork} alt={np.title} />}
        </div>
      )}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
        <Item cur={cur} to={{ name: 'settings' }} icon={<GearSix {...ic} />} label={t.settings} />
        {priv && <span className="pill accent" title={t.privateHint}>{t.privateSession}</span>}
      </div>
    </aside>
  )
}
