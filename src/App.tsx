import { WifiSlash } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Fullscreen, SidePanel } from './components/Panels'
import { PlayerBar } from './components/PlayerBar'
import { Settings } from './components/Settings'
import { Sidebar } from './components/Sidebar'
import { TrackMenuHost } from './components/TrackMenu'
import { PromptHost, Toast } from './components/ui'
import { useT } from './lib/i18n'
import { current, usePlayer } from './store/player'
import { useRouter } from './store/router'
import { useOnline } from './views/hooks'
import { AlbumView, ArtistView, Downloads, History, Home, LibraryView, Liked, LocalFiles, PlaylistView, Search } from './views/Views'

function Page() {
  const { stack, pos } = useRouter()
  const r = stack[pos]
  const key = pos + r.name + ('id' in r ? r.id : '')
  switch (r.name) {
    case 'home': return <Home key={key} />
    case 'search': return <Search key={key} q={r.q} />
    case 'library': return <LibraryView key={key} />
    case 'liked': return <Liked key={key} />
    case 'local': return <LocalFiles key={key} />
    case 'downloads': return <Downloads key={key} />
    case 'history': return <History key={key} />
    case 'playlist': return <PlaylistView key={key} id={r.id} />
    case 'album': return <AlbumView key={key} id={r.id} />
    case 'artist': return <ArtistView key={key} id={r.id} />
  }
}

export function App() {
  const t = useT()
  const [settings, setSettings] = useState(false)
  usePlayer((s) => s.index)
  const art = current()?.artwork
  const online = useOnline()
  const scroller = useRef<HTMLDivElement>(null)
  const pos = useRouter((s) => s.pos)
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [pos])

  return (
    <>
      <div className="ambient" aria-hidden>{art && <img key={art} src={art} alt="" />}</div>
      <div className="grain" aria-hidden />
      <div className="shell">
        <Sidebar onSettings={() => setSettings(true)} />
        <main className="main">
          <div className="topbar drag" />
          <div className="scroll" ref={scroller}>
            {!online && <div className="banner" role="status"><WifiSlash size={18} />{t.offline}</div>}
            <Page />
          </div>
        </main>
        <SidePanel />
        <PlayerBar />
      </div>
      <Fullscreen />
      <TrackMenuHost />
      <PromptHost />
      <Toast />
      {settings && <Settings onClose={() => setSettings(false)} />}
    </>
  )
}
