import { CloudCheck, DotsThree, Heart, Play } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { library, useLibrary } from '../store/library'
import { current, playQueue, toggle, usePlayer } from '../store/player'
import { navigate } from '../store/router'
import { openTrackMenu } from './TrackMenu'
import { fmt, Img } from './ui'

export function Eq({ paused }: { paused?: boolean }) {
  return <span className={'eq' + (paused ? ' paused' : '')} aria-hidden><i /><i /><i /></span>
}

export function TrackList({ tracks, showAlbum = true, playlistId, onReorder }: {
  tracks: Track[]; showAlbum?: boolean; playlistId?: string; onReorder?(from: number, to: number): void
}) {
  const t = useT()
  const liked = useLibrary((s) => s.liked)
  const downloads = useLibrary((s) => s.downloads)
  usePlayer((s) => s.index) // re-render on track change
  const playing = usePlayer((s) => s.playing)
  const nowId = current()?.id
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  return (
    <div className="rows" role="list">
      {tracks.map((tr, i) => {
        const isNow = tr.id === nowId
        const isLiked = liked.includes(tr.id)
        return (
          <div key={tr.id + i} role="listitem" aria-current={isNow} tabIndex={0}
            className={'row' + (dragFrom === i ? ' dragging' : '') + (dropAt === i && dragFrom !== null ? ' drop-line' : '')}
            draggable={!!onReorder}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => { if (onReorder) { e.preventDefault(); setDropAt(i) } }}
            onDrop={() => { if (onReorder && dragFrom !== null && dragFrom !== i) onReorder(dragFrom, i); setDragFrom(null); setDropAt(null) }}
            onDragEnd={() => { setDragFrom(null); setDropAt(null) }}
            onDoubleClick={() => (isNow ? toggle() : playQueue(tracks, i))}
            onKeyDown={(e) => e.key === 'Enter' && (isNow ? toggle() : playQueue(tracks, i))}
            onContextMenu={(e) => openTrackMenu(e, tr, playlistId)}>
            <button className="n tabular" aria-label={`${t.play} ${tr.title}`} onClick={() => (isNow ? toggle() : playQueue(tracks, i))}>
              {isNow ? <Eq paused={!playing} /> : <><span className="num">{i + 1}</span><Play className="play-ico" size={14} weight="fill" /></>}
            </button>
            <div className="art"><Img src={tr.artwork} alt="" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="rt">{tr.title}</div>
              <div className="ra">
                {downloads[tr.id] && <CloudCheck size={13} weight="fill" style={{ verticalAlign: -2, marginRight: 4, color: 'var(--accent)' }} aria-label={t.downloaded} />}
                {tr.artistId ? <button className="linkish" onClick={() => navigate({ name: 'artist', id: tr.artistId! })}>{tr.artist}</button> : tr.artist}
              </div>
            </div>
            {showAlbum ? <div className="al">{tr.album}</div> : <div className="al" />}
            <button className={'icon-btn sm' + (isLiked ? '' : ' hide')} aria-pressed={isLiked} aria-label={isLiked ? t.unlike : t.like} onClick={() => library.toggleLike(tr)}>
              <Heart size={17} weight={isLiked ? 'fill' : 'regular'} color={isLiked ? 'var(--accent)' : undefined} />
            </button>
            <div className="d tabular">{fmt(tr.duration)}</div>
            <button className="icon-btn sm hide" aria-label={t.more} onClick={(e) => openTrackMenu(e, tr, playlistId)}><DotsThree size={20} weight="bold" /></button>
          </div>
        )
      })}
    </div>
  )
}
