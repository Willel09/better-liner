import { X } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { LANGS, useT } from '../lib/i18n'
import { SHORTCUTS } from '../store/bridge'
import { useLibrary } from '../store/library'
import { ACCENTS, useSettings } from '../store/settings'
import { toast } from './ui'

const Switch = ({ on, set, label }: { on: boolean; set(v: boolean): void; label: string }) =>
  <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} />

function Seg<T extends string | number>({ value, options, set }: { value: T; options: [T, string][]; set(v: T): void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => set(v)}>{l}</button>)}</div>
}

const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) =>
  <div><div><div style={{ fontWeight: 550 }}>{label}</div>{hint && <div className="hint">{hint}</div>}</div>{children}</div>

export function Settings({ onClose }: { onClose(): void }) {
  const t = useT()
  const s = useSettings()
  const set = useSettings.set
  const [tab, setTab] = useState<'appearance' | 'playback' | 'lyricsSettings' | 'discord' | 'storage' | 'shortcuts' | 'about'>('appearance')
  const [size, setSize] = useState<number | null>(null)
  const [ver, setVer] = useState('')
  useEffect(() => { window.lumen?.cacheSize().then(setSize); window.lumen?.info().then((i) => setVer(i.version)) }, [])
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])

  const tabs = ['appearance', 'playback', 'lyricsSettings', 'discord', 'storage', 'shortcuts', 'about'] as const
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog wide glass" role="dialog" aria-label={t.settings}>
        <nav className="settings-nav">
          <div className="eyebrow" style={{ padding: '0 12px 10px' }}>{t.settings}</div>
          {tabs.map((k) => <button key={k} className="side-item" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><span>{t[k]}</span></button>)}
        </nav>
        <div className="settings-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{t[tab]}</h2>
            <button className="icon-btn sm" aria-label={t.close} onClick={onClose}><X size={18} /></button>
          </div>

          {tab === 'appearance' && <div className="group">
            <Row label={t.language}><Seg value={s.lang} options={Object.entries(LANGS) as [typeof s.lang, string][]} set={(lang) => set({ lang })} /></Row>
            <Row label={t.theme}><Seg value={s.theme} options={[['system', t.system], ['dark', t.dark], ['light', t.light]]} set={(theme) => set({ theme })} /></Row>
            <Row label={t.accent}>
              <div style={{ display: 'flex', gap: 10 }}>
                {Object.entries(ACCENTS).map(([k, c]) => <button key={k} className="swatch" aria-label={k} aria-pressed={s.accent === k} style={{ background: c, color: c }} onClick={() => set({ accent: k as typeof s.accent })} />)}
              </div>
            </Row>
            <Row label={t.visuals} hint={t.visualsHint}><Switch label={t.visuals} on={s.visuals} set={(visuals) => set({ visuals })} /></Row>
          </div>}

          {tab === 'playback' && <div className="group">
            <Row label={t.crossfade}><Seg value={s.crossfade} options={[[0, 'Av'], [3, '3 s'], [6, '6 s'], [10, '10 s']]} set={(crossfade) => set({ crossfade })} /></Row>
            <Row label={t.normalize}><Switch label={t.normalize} on={s.normalize} set={(normalize) => set({ normalize })} /></Row>
          </div>}

          {tab === 'lyricsSettings' && <div className="group">
            <Row label={t.wordSync}><Switch label={t.wordSync} on={s.wordSync} set={(wordSync) => set({ wordSync })} /></Row>
            <Row label={t.lyricsOffset} hint={`${s.lyricsOffset > 0 ? '+' : ''}${s.lyricsOffset.toFixed(1)} s`}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn" onClick={() => set({ lyricsOffset: +(s.lyricsOffset - 0.1).toFixed(1) })}>−0.1</button>
                <button className="btn" onClick={() => set({ lyricsOffset: 0 })}>0</button>
                <button className="btn" onClick={() => set({ lyricsOffset: +(s.lyricsOffset + 0.1).toFixed(1) })}>+0.1</button>
              </div>
            </Row>
          </div>}

          {tab === 'discord' && <div className="group">
            <Row label={t.discord} hint={t.discordHint}>
              <label className="field" style={{ width: 220 }}><input value={s.discordId} onChange={(e) => set({ discordId: e.target.value.replace(/\D/g, '') })} placeholder="123456789012345678" inputMode="numeric" aria-label={t.discord} /></label>
            </Row>
          </div>}

          {tab === 'storage' && <div className="group">
            <Row label={t.cache} hint={size == null ? '…' : `${(size / 1048576).toFixed(1)} MB`}>
              <button className="btn" onClick={async () => { await window.lumen?.clearCache(); useLibrary.set({ downloads: {} }); setSize(0); toast(t.clearCache) }}>{t.clearCache}</button>
            </Row>
          </div>}

          {tab === 'shortcuts' && <div className="group">
            {SHORTCUTS.map(([k, d]) => <Row key={k} label={d}><kbd>{k}</kbd></Row>)}
          </div>}

          {tab === 'about' && <div className="group">
            <Row label="Lumen" hint="Music: Audius · Lyrics: LRCLIB · Icons: Phosphor">{ver && <span className="faint tabular">v{ver}</span>}</Row>
          </div>}
        </div>
      </div>
    </div>
  )
}
