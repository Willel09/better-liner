import { BookmarkSimple, Broadcast, EyeSlash, Heart, ListPlus, MagicWand, Playlist as PlaylistIcon, Prohibit, Queue, Sparkle, User, X } from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { analyzeTracks, similarTo } from '../lib/ai'
import { errText } from '../lib/api'
import { useT } from '../lib/i18n'
import { primaryArtist } from '../lib/tracks'
import type { Track } from '../lib/types'
import { create } from '../store/create'
import { library, useLibrary } from '../store/library'
import { enqueue, playQueue } from '../store/player'
import { navigate } from '../store/router'
import { useSettings } from '../store/settings'
import { prompt, toast } from './ui'

type MenuReq = { x: number; y: number; track: Track; playlistId?: string }
const useMenu = create({ req: null as MenuReq | null })

export const openTrackMenu = (e: { clientX: number; clientY: number; preventDefault?(): void }, track: Track, playlistId?: string) => {
  e.preventDefault?.()
  useMenu.set({ req: { x: e.clientX, y: e.clientY, track, playlistId } })
}

export async function startRadio(t: Track, sv: boolean) {
  toast(sv ? 'Startar radio…' : 'Starting radio…')
  try { playQueue([t, ...(await similarTo(t, 15))]) } catch (e) { toast(errText(e, sv)) }
}

export function TrackMenuHost() {
  const req = useMenu((s) => s.req)
  const t = useT()
  const sv = useSettings((s) => s.lang) === 'sv'
  const { liked, playlists, saved } = useLibrary()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const close = () => useMenu.set({ req: null })

  useLayoutEffect(() => {
    if (!req || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.max(8, Math.min(req.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(req.y, innerHeight - r.height - 8)) })
    ref.current.querySelector('button')?.focus()
  }, [req])
  useEffect(() => {
    if (!req) return
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) close() }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...ref.current!.querySelectorAll('button')]
        const i = items.indexOf(document.activeElement as HTMLButtonElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        e.preventDefault()
      }
    }
    addEventListener('mousedown', off); addEventListener('keydown', key, true)
    return () => { removeEventListener('mousedown', off); removeEventListener('keydown', key, true) }
  }, [req])

  if (!req) return null
  const tr = req.track
  const act = (fn: () => unknown) => () => { close(); fn() }
  const isLiked = liked.includes(tr.id)

  return (
    <div ref={ref} className="menu glass" role="menu" style={{ left: pos.x, top: pos.y }}>
      <button role="menuitem" onClick={act(() => enqueue([tr], true))}><Queue size={17} />{t.playNext}</button>
      <button role="menuitem" onClick={act(() => enqueue([tr]))}><ListPlus size={17} />{t.addToQueue}</button>
      <button role="menuitem" onClick={act(() => library.toggleLike(tr))}><Heart size={17} weight={isLiked ? 'fill' : 'regular'} />{isLiked ? t.unlike : t.like}</button>
      {!saved.includes(tr.id) && <button role="menuitem" onClick={act(() => { library.save([tr]); toast(t.savedToLibrary) })}><BookmarkSimple size={17} />{t.saveToLibrary}</button>}
      <hr />
      <button role="menuitem" onClick={act(() => startRadio(tr, sv))}><Broadcast size={17} />{t.startRadio}</button>
      <button role="menuitem" onClick={act(() => navigate({ name: 'similar', id: tr.id }))}><Sparkle size={17} />{t.similar}</button>
      <button role="menuitem" onClick={act(() => analyzeTracks([tr]).then(() => toast(t.analyzed), (e) => toast(errText(e, sv))))}><MagicWand size={17} />{t.analyze}</button>
      <hr />
      <div className="sub-label">{t.addToPlaylist}</div>
      {playlists.filter((p) => !p.smart).slice(0, 8).map((p) => (
        <button key={p.id} role="menuitem" onClick={act(() => { library.addToPlaylist(p.id, [tr]); toast(p.name) })}><PlaylistIcon size={17} />{p.name}</button>
      ))}
      <button role="menuitem" onClick={act(async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n) library.createPlaylist(n, [tr.id]) })}><ListPlus size={17} />{t.newPlaylist}…</button>
      {req.playlistId && <button role="menuitem" onClick={act(() => library.removeFromPlaylist(req.playlistId!, tr.id))}><X size={17} />{t.removeFromPlaylist}</button>}
      <hr />
      <button role="menuitem" onClick={act(() => navigate({ name: 'artist', name_: primaryArtist(tr.artist) }))}><User size={17} />{t.goToArtist}</button>
      <button role="menuitem" onClick={act(() => { library.hide(tr.id); toast(t.hidden) })}><EyeSlash size={17} />{t.hideSong}</button>
      <button role="menuitem" onClick={act(() => { library.ban(primaryArtist(tr.artist)); toast(t.banned) })}><Prohibit size={17} />{t.banArtist}</button>
    </div>
  )
}
