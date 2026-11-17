import { CloudArrowDown, Heart, LinkSimple, ListPlus, Playlist as PlaylistIcon, Queue, Trash, User, X } from '@phosphor-icons/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { streamUrl } from '../lib/audius'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { create } from '../store/create'
import { library, useLibrary } from '../store/library'
import { enqueue } from '../store/player'
import { navigate } from '../store/router'
import { prompt, toast } from './ui'

type MenuReq = { x: number; y: number; track: Track; playlistId?: string }
const useMenu = create({ req: null as MenuReq | null })

export const openTrackMenu = (e: { clientX: number; clientY: number; preventDefault?(): void }, track: Track, playlistId?: string) => {
  e.preventDefault?.()
  useMenu.set({ req: { x: e.clientX, y: e.clientY, track, playlistId } })
}

export async function downloadTrack(t: Track, t9n: ReturnType<typeof useT>) {
  if (t.source !== 'audius' || !window.lumen) return
  toast(t9n.downloading)
  try { await library.download(t, streamUrl(t.id)); toast(t9n.downloaded) } catch { toast(t9n.error) }
}

export function TrackMenuHost() {
  const req = useMenu((s) => s.req)
  const t = useT()
  const { liked, playlists, downloads } = useLibrary()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const close = () => useMenu.set({ req: null })

  useLayoutEffect(() => {
    if (!req || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(req.x, innerWidth - r.width - 8), y: Math.min(req.y, innerHeight - r.height - 8) })
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
    addEventListener('mousedown', off); addEventListener('keydown', key, true); addEventListener('blur', close)
    return () => { removeEventListener('mousedown', off); removeEventListener('keydown', key, true); removeEventListener('blur', close) }
  }, [req])

  if (!req) return null
  const tr = req.track
  const act = (fn: () => unknown) => () => { close(); fn() }
  const isLiked = liked.includes(tr.id)

  return (
    <div ref={ref} className="menu glass" role="menu" style={{ left: pos.x, top: pos.y }}>
      <button role="menuitem" onClick={act(() => enqueue(tr, true))}><Queue size={17} />{t.playNext}</button>
      <button role="menuitem" onClick={act(() => enqueue(tr))}><ListPlus size={17} />{t.addToQueue}</button>
      <button role="menuitem" onClick={act(() => library.toggleLike(tr))}><Heart size={17} weight={isLiked ? 'fill' : 'regular'} />{isLiked ? t.unlike : t.like}</button>
      <hr />
      <div className="sub-label">{t.addToPlaylist}</div>
      {playlists.map((p) => (
        <button key={p.id} role="menuitem" onClick={act(() => { library.addToPlaylist(p.id, tr); toast(p.name) })}><PlaylistIcon size={17} />{p.name}</button>
      ))}
      <button role="menuitem" onClick={act(async () => {
        const name = await prompt(t.newPlaylist, '', t.create, t.cancel)
        if (name) library.createPlaylist(name, [tr.id])
      })}><ListPlus size={17} />{t.newPlaylist}…</button>
      {req.playlistId && <button role="menuitem" onClick={act(() => library.removeFromPlaylist(req.playlistId!, tr.id))}><X size={17} />{t.removeFromPlaylist}</button>}
      <hr />
      {tr.artistId && <button role="menuitem" onClick={act(() => navigate({ name: 'artist', id: tr.artistId! }))}><User size={17} />{t.goToArtist}</button>}
      {tr.source === 'audius' && (downloads[tr.id]
        ? <button role="menuitem" onClick={act(() => library.removeDownload(tr.id))}><Trash size={17} />{t.removeDownload}</button>
        : <button role="menuitem" onClick={act(() => downloadTrack(tr, t))}><CloudArrowDown size={17} />{t.download}</button>)}
      {tr.source === 'audius' && <button role="menuitem" onClick={act(() => { navigator.clipboard.writeText(`lumen://track/${tr.id.replace('audius:', '')}`); toast(t.copied) })}><LinkSimple size={17} />{t.copyLink}</button>}
      {tr.source === 'local' && <button role="menuitem" onClick={act(() => library.removeLocal(tr.id))}><Trash size={17} />{t.delete}</button>}
    </div>
  )
}
