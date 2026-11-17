import { ArrowClockwise, CheckCircle, DownloadSimple } from '@phosphor-icons/react'
import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useEffect, useState } from 'react'
import { isTauri } from '../lib/api'
import { useT } from '../lib/i18n'

type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'latest' } | { kind: 'available'; update: Update }
  | { kind: 'downloading'; pct: number } | { kind: 'error'; msg: string }

/** "Update app" — checks GitHub Releases, downloads the signed update and restarts into it. */
export function UpdateCard() {
  const t = useT()
  const [version, setVersion] = useState('')
  const [st, setSt] = useState<State>({ kind: 'idle' })
  useEffect(() => { if (isTauri) getVersion().then(setVersion) }, [])

  const run = async () => {
    setSt({ kind: 'checking' })
    try {
      const update = await check()
      setSt(update ? { kind: 'available', update } : { kind: 'latest' })
    } catch (e) { setSt({ kind: 'error', msg: String((e as Error)?.message ?? e) }) }
  }
  const install = async (update: Update) => {
    let total = 0, got = 0
    setSt({ kind: 'downloading', pct: 0 })
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === 'Started') total = ev.data.contentLength ?? 0
        if (ev.event === 'Progress') { got += ev.data.chunkLength; setSt({ kind: 'downloading', pct: total ? got / total : 0 }) }
      })
      await relaunch()
    } catch (e) { setSt({ kind: 'error', msg: String((e as Error)?.message ?? e) }) }
  }

  return (
    <div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 550 }}>{t.updates}</div>
        <div className="hint">
          {t.version} {version || '–'}
          {st.kind === 'latest' && <> · <CheckCircle size={12} weight="fill" color="#34c759" style={{ verticalAlign: -1 }} /> {t.upToDate}</>}
          {st.kind === 'available' && <> · {t.updateAvailable} {st.update.version}</>}
          {st.kind === 'error' && <> · <span style={{ color: 'var(--accent)' }}>{t.updateFailed}</span></>}
        </div>
        {st.kind === 'available' && st.update.body && <div className="hint" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{st.update.body}</div>}
        {st.kind === 'downloading' && <div className="progress-line" style={{ marginTop: 8, maxWidth: 320 }}><i style={{ width: `${Math.round(st.pct * 100)}%` }} /></div>}
      </div>
      {st.kind === 'available'
        ? <button className="btn primary" onClick={() => install(st.update)}><DownloadSimple size={16} />{t.installRestart}</button>
        : <button className="btn" disabled={!isTauri || st.kind === 'checking' || st.kind === 'downloading'} onClick={run}>
            <ArrowClockwise size={16} className={st.kind === 'checking' ? 'spin' : undefined} />{st.kind === 'downloading' ? t.downloadingUpdate : t.checkUpdates}
          </button>}
    </div>
  )
}
