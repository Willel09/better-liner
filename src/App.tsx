import { WifiSlash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar } from './components/Sidebar'
import { TrackMenuHost } from './components/TrackMenu'
import { PromptHost, Toast } from './components/ui'
import { useT } from './lib/i18n'
import { current, usePlayer } from './store/player'
import { useRouter } from './store/router'
import { Discover, Similar } from './views/Discover'
import { Home } from './views/Home'
import { AlbumView, Albums, ArtistView, Artists, LibraryView, Liked, PlaylistView, Playlists } from './views/Library'
import { NowPlaying } from './views/NowPlaying'
import { SettingsPage } from './views/SettingsPage'
import { Stats } from './views/Stats'
import { Studio } from './views/Studio'

function Page() {
  const { stack, pos } = useRouter()
  const r = stack[pos]
  const key = pos + JSON.stringify(r)
  switch (r.name) {
    case 'home': return <Home key={key} />
    case 'discover': return <Discover key={key} />
    case 'search': return <Discover key={key} q={r.q} />
    case 'library': return <LibraryView key={key} />
    case 'playlists': return <Playlists key={key} />
    case 'playlist': return <PlaylistView key={key} id={r.id} />
    case 'liked': return <Liked key={key} />
    case 'artists': return <Artists key={key} />
    case 'artist': return <ArtistView key={key} name={r.name_} />
    case 'albums': return <Albums key={key} />
    case 'album': return <AlbumView key={key} k={r.key} />
    case 'now': return <NowPlaying key={key} />
    case 'studio': return <Studio key={key} />
    case 'stats': return <Stats key={key} />
    case 'settings': return <SettingsPage key={key} />
    case 'similar': return <Similar key={key} id={r.id} />
  }
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    addEventListener('online', up); addEventListener('offline', down)
    return () => { removeEventListener('online', up); removeEventListener('offline', down) }
  }, [])
  return on
}

export function App() {
  const t = useT()
  usePlayer((s) => s.index)
  const art = current()?.artwork
  const online = useOnline()
  const scroller = useRef<HTMLDivElement>(null)
  const { pos, stack } = useRouter()
  const onNow = stack[pos].name === 'now'
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [pos])

  return (
    <>
      <div className="ambient" aria-hidden>{art && <img key={art} src={art} alt="" />}</div>
      <div className="grain" aria-hidden />
      <div className="shell">
        <Sidebar />
        <main className={'main' + (onNow ? ' main-now' : '')}>
          <div className="topbar drag" />
          <div className="scroll" ref={scroller}>
            {!online && <div className="banner" role="status"><WifiSlash size={18} />{t.error}</div>}
            <Page />
          </div>
        </main>
        <PlayerBar />
      </div>
      <TrackMenuHost />
      <PromptHost />
      <Toast />
    </>
  )
}
