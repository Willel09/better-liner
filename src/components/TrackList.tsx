import { DotsThree, Heart, Play } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { primaryArtist } from '../lib/tracks'
import { library, useLibrary } from '../store/library'
import { current, playQueue, toggle, usePlayer } from '../store/player'
import { navigate } from '../store/router'
import { openTrackMenu } from './TrackMenu'
import { fmt, Img } from './ui'

export function Eq({ paused }: { paused?: boolean }) {
  return <span className={'eq' + (paused ? ' paused' : '')} aria-hidden><i /><i /><i /></span>
}

export function TrackList({ tracks, playlistId, onReorder, showFeatures = true, why }: {
  tracks: Track[]; playlistId?: string; onReorder?(from: number, to: number): void; showFeatures?: boolean; why?: Record<string, string>
}) {
  const t = useT()
  const liked = useLibrary((s) => s.liked)
  const feats = useLibrary((s) => s.features)
  usePlayer((s) => s.index)
  const playing = usePlayer((s) => s.playing)
  const nowId = current()?.id
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  return (
    <div className="rows" role="list">
      {tracks.map((tr, i) => {
        const isNow = tr.id === nowId
        const isLiked = liked.includes(tr.id)
        const f = feats[tr.id]
        const go = () => (isNow ? toggle() : playQueue(tracks, i))
        return (
          <div key={tr.id + i} role="listitem" aria-current={isNow} tabIndex={0}
            className={'row' + (dragFrom === i ? ' dragging' : '') + (dropAt === i && dragFrom !== null ? ' drop-line' : '')}
            draggable={!!onReorder}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => { if (onReorder) { e.preventDefault(); setDropAt(i) } }}
            onDrop={() => { if (onReorder && dragFrom !== null && dragFrom !== i) onReorder(dragFrom, i); setDragFrom(null); setDropAt(null) }}
            onDragEnd={() => { setDragFrom(null); setDropAt(null) }}
            onDoubleClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}
            onContextMenu={(e) => openTrackMenu(e, tr, playlistId)}>
            <button className="n tabular" aria-label={`${t.play} ${tr.title}`} onClick={go}>
              {isNow ? <Eq paused={!playing} /> : <><span className="num">{i + 1}</span><Play className="play-ico" size={14} weight="fill" /></>}
            </button>
            <div className="art"><Img src={tr.artwork} alt="" /></div>
            <div style={{ minWidth: 0 }}>
              <div className="rt">{tr.source === 'ref' && <span className="ref-dot" title={t.notMatched} />}{tr.title}</div>
              <div className="ra">
                <button className="linkish" onClick={() => navigate({ name: 'artist', name_: primaryArtist(tr.artist) })}>{tr.artist}</button>
                {why?.[tr.id] && <span className="faint"> · {why[tr.id]}</span>}
              </div>
            </div>
            <div className="al row-gap" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
              {showFeatures && f?.mood && <span className="pill">{t.moods[f.mood as keyof typeof t.moods] ?? f.mood}</span>}
              {showFeatures && (f?.genre || tr.genre) && <span className="pill">{f?.genre ?? tr.genre}</span>}
              {showFeatures && f?.bpm ? <span className="pill tabular">{Math.round(f.bpm)} BPM</span> : null}
              {!showFeatures && tr.album}
            </div>
            <button className={'icon-btn sm' + (isLiked ? '' : ' hide')} aria-pressed={isLiked} aria-label={isLiked ? t.unlike : t.like} onClick={() => library.toggleLike(tr)}>
              <Heart size={17} weight={isLiked ? 'fill' : 'regular'} color={isLiked ? 'var(--accent)' : undefined} />
            </button>
            <div className="d tabular">{tr.duration ? fmt(tr.duration) : '–'}</div>
            <button className="icon-btn sm hide" aria-label={t.more} onClick={(e) => openTrackMenu(e, tr, playlistId)}><DotsThree size={20} weight="bold" /></button>
          </div>
        )
      })}
    </div>
  )
}
