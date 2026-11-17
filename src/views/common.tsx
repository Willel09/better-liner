import { ArrowCounterClockwise, Key, Play, Shuffle, Sparkle, WifiSlash, YoutubeLogo } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Empty, Img } from '../components/ui'
import { errText } from '../lib/api'
import { useT } from '../lib/i18n'
import type { Track } from '../lib/types'
import { playQueue, toggleShuffle, usePlayer } from '../store/player'
import { navigate } from '../store/router'
import { useSettings } from '../store/settings'
import { useStatus } from '../store/status'

export function ErrorState({ error, retry }: { error: unknown; retry?(): void }) {
  const t = useT()
  const sv = useSettings((s) => s.lang) === 'sv'
  const msg = errText(error, sv)
  const needsKey = /nokey|nyckel|key/i.test(String((error as Error)?.message ?? error))
  return (
    <Empty icon={needsKey ? <Key size={40} weight="duotone" /> : <WifiSlash size={40} weight="duotone" />} text={msg}>
      {needsKey ? <button className="btn" onClick={() => navigate({ name: 'settings' })}>{t.openSettings}</button>
        : retry && <button className="btn" onClick={retry}><ArrowCounterClockwise size={16} />{t.retry}</button>}
    </Empty>
  )
}

export function PlayActions({ tracks, children }: { tracks: Track[]; children?: ReactNode }) {
  const t = useT()
  return (
    <div className="actions">
      <button className="play-fab" aria-label={t.play} disabled={!tracks.length} onClick={() => { if (usePlayer.get().shuffle) toggleShuffle(); playQueue(tracks) }}><Play size={22} weight="fill" /></button>
      <button className="btn glassy" disabled={!tracks.length} onClick={() => { if (!usePlayer.get().shuffle) toggleShuffle(); playQueue(tracks, Math.floor(Math.random() * tracks.length)) }}><Shuffle size={16} weight="bold" />{t.shuffle}</button>
      {children}
    </div>
  )
}

export function CollectionHeader({ title, sub, art, kind, children }: { title: string; sub: string; art: ReactNode | string | null; kind: string; children?: ReactNode }) {
  return (
    <header className="hero">
      <div className="cover">{typeof art === 'string' || art === null ? <Img src={art} alt={title} /> : art}</div>
      <div className="meta">
        <div className="eyebrow">{kind}</div>
        <h1 className="h-hero">{title}</h1>
        <div className="muted">{sub}</div>
        {children}
      </div>
    </header>
  )
}

/** Cards prompting the user to connect YouTube / AI when missing. */
export function ConnectCards() {
  const t = useT()
  const st = useStatus()
  if (st.youtube && st.ai) return null
  return (
    <div className="bento" style={{ marginBottom: 14 }}>
      {!st.youtube && (
        <div className="notice glass span-6">
          <div className="ico"><YoutubeLogo size={24} weight="fill" /></div>
          <div style={{ flex: 1 }}><b>{t.connectYt}</b><div className="muted" style={{ fontSize: 12.5 }}>{t.connectYtHint}</div></div>
          <button className="btn primary" onClick={() => navigate({ name: 'settings' })}>{t.openSettings}</button>
        </div>
      )}
      {!st.ai && (
        <div className="notice glass span-6">
          <div className="ico"><Sparkle size={24} weight="fill" /></div>
          <div style={{ flex: 1 }}><b>{t.connectAi}</b><div className="muted" style={{ fontSize: 12.5 }}>{t.connectAiHint}</div></div>
          <button className="btn" onClick={() => navigate({ name: 'settings' })}>{t.openSettings}</button>
        </div>
      )}
    </div>
  )
}

export const totalMin = (ts: Track[]) => Math.round(ts.reduce((a, x) => a + (x.duration || 0), 0) / 60)
