import { CaretLeft, CaretRight, ClockCounterClockwise, CloudArrowDown, FolderSimple, GearSix, Heart, House, MagnifyingGlass, Plus, Books } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useT } from '../lib/i18n'
import type { Route } from '../lib/types'
import { library, useLibrary } from '../store/library'
import { back, forward, navigate, useRouter } from '../store/router'
import { Img, prompt } from './ui'

function Item({ to, icon, label, cur }: { to: Route; icon: ReactNode; label: string; cur: Route }) {
  const active = cur.name === to.name && (('id' in to) ? 'id' in cur && cur.id === to.id : true)
  return (
    <button className="side-item" aria-current={active ? 'page' : undefined} onClick={() => navigate(to)}>
      {icon}<span>{label}</span>
    </button>
  )
}

export function Sidebar({ onSettings }: { onSettings(): void }) {
  const t = useT()
  const { stack, pos } = useRouter()
  const cur = stack[pos]
  const { playlists, tracks, savedAlbums, followed } = useLibrary()
  const ic = { size: 19, weight: 'regular' as const }

  return (
    <aside className="sidebar glass drag" aria-label="Sidebar">
      <div style={{ position: 'absolute', top: 12, right: 10, display: 'flex' }}>
        <button className="icon-btn sm" aria-label="Back" disabled={pos === 0} onClick={back}><CaretLeft size={16} weight="bold" /></button>
        <button className="icon-btn sm" aria-label="Forward" disabled={pos >= stack.length - 1} onClick={forward}><CaretRight size={16} weight="bold" /></button>
      </div>
      <nav className="no-drag">
        <Item cur={cur} to={{ name: 'home' }} icon={<House {...ic} />} label={t.home} />
        <Item cur={cur} to={{ name: 'search' }} icon={<MagnifyingGlass {...ic} />} label={t.search} />
        <Item cur={cur} to={{ name: 'library' }} icon={<Books {...ic} />} label={t.library} />
      </nav>
      <div className="side-label">{t.yourMusic}</div>
      <nav className="no-drag">
        <Item cur={cur} to={{ name: 'liked' }} icon={<Heart {...ic} />} label={t.liked} />
        <Item cur={cur} to={{ name: 'local' }} icon={<FolderSimple {...ic} />} label={t.local} />
        <Item cur={cur} to={{ name: 'downloads' }} icon={<CloudArrowDown {...ic} />} label={t.downloads} />
        <Item cur={cur} to={{ name: 'history' }} icon={<ClockCounterClockwise {...ic} />} label={t.history} />
      </nav>
      <div className="side-label">
        {t.playlists}
        <button className="icon-btn sm no-drag" style={{ width: 28, height: 28 }} aria-label={t.newPlaylist}
          onClick={async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n) navigate({ name: 'playlist', id: library.createPlaylist(n).id }) }}>
          <Plus size={14} weight="bold" />
        </button>
      </div>
      <div className="side-scroll no-drag">
        {playlists.map((p) => (
          <Item key={p.id} cur={cur} to={{ name: 'playlist', id: p.id }} label={p.name}
            icon={<span className="thumb"><Img src={tracks[p.trackIds[0]]?.artwork} alt="" /></span>} />
        ))}
        {savedAlbums.map((a) => <Item key={a.id} cur={cur} to={{ name: 'album', id: a.id }} label={a.name} icon={<span className="thumb"><Img src={a.artwork} alt="" /></span>} />)}
        {followed.map((a) => <Item key={a.id} cur={cur} to={{ name: 'artist', id: a.id }} label={a.name} icon={<span className="thumb" style={{ borderRadius: '50%' }}><Img src={a.avatar} alt="" /></span>} />)}
      </div>
      <button className="side-item no-drag" onClick={onSettings}><GearSix {...ic} /><span>{t.settings}</span></button>
    </aside>
  )
}
