import { CheckCircle, FolderPlus, XCircle } from '@phosphor-icons/react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from '../components/ui'
import { UpdateCard } from '../components/UpdateCard'
import { api, errText } from '../lib/api'
import { LANGS, useT } from '../lib/i18n'
import { SHORTCUTS } from '../store/bridge'
import { library, useLibrary } from '../store/library'
import { reshuffleUpNext } from '../store/player'
import { ACCENTS, AI_PRESETS, EQ_BANDS, EQ_PRESETS, useSettings } from '../store/settings'
import { refreshStatus, useStatus } from '../store/status'
import { addLocalFolder } from './Library'

const Switch = ({ on, set, label }: { on: boolean; set(v: boolean): void; label: string }) =>
  <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} />

function Seg<T extends string | number>({ value, options, set }: { value: T; options: readonly (readonly [T, string])[]; set(v: T): void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => set(v)}>{l}</button>)}</div>
}

const Row = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) =>
  <div><div style={{ minWidth: 0 }}><div style={{ fontWeight: 550 }}>{label}</div>{hint && <div className="hint">{hint}</div>}</div><div className="row-gap" style={{ flexWrap: 'nowrap' }}>{children}</div></div>

/** Write-only secret field: shows whether a key is set, never its value. */
function KeyField({ name, isSet, placeholder }: { name: string; isSet: boolean; placeholder?: string }) {
  const t = useT()
  const [v, setV] = useState('')
  const save = async () => {
    try { await api.configSet({ [name]: v }); setV(''); await refreshStatus(); toast(t.keySaved) } catch (e) { toast(errText(e, useSettings.get().lang === 'sv')) }
  }
  return (
    <form className="row-gap" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); save() }}>
      <span className="pill" style={{ color: isSet ? 'var(--text)' : undefined }}>{isSet ? <CheckCircle size={13} weight="fill" color="#34c759" /> : <XCircle size={13} />}{isSet ? t.set : t.notSet}</span>
      <label className="field key-field" style={{ height: 34 }}><input type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder ?? '••••••••'} aria-label={name} autoComplete="off" /></label>
      <button className="btn" type="submit" disabled={!v.trim()} style={{ height: 34 }}>{t.save}</button>
    </form>
  )
}

export function SettingsPage() {
  const t = useT()
  const s = useSettings()
  const set = useSettings.set
  const st = useStatus()
  const lib = useLibrary()
  const sv = s.lang === 'sv'
  const [testing, setTesting] = useState<'' | 'ok' | 'busy' | string>('')
  useEffect(() => { refreshStatus() }, [])
  const today = new Date().toISOString().slice(0, 10)
  const searches = s.ytSearchesToday[1] === today ? s.ytSearchesToday[0] : 0

  const [models, setModels] = useState<string[]>([])
  const preset = async (k: keyof typeof AI_PRESETS) => {
    set({ aiPreset: k })
    setModels([]); setTesting('')
    const p = AI_PRESETS[k]
    await api.configSet({ ai_base: p.base, ai_model: p.model, ai_protocol: p.protocol }).catch(() => {})
    refreshStatus()
  }
  const fetchModels = async () => {
    try { const m = await api.aiModels(); setModels(m); if (!m.length) toast(t.none) } catch (e) { toast(errText(e, sv)) }
  }

  return (
    <div className="page settings-page">
      <div className="page-head"><h1 className="h-page">{t.settings}</h1></div>

      <h2>{t.about}</h2>
      <div className="group"><UpdateCard /></div>

      <h2>{t.sound}</h2>
      <div className="group">
        <Row label={t.crossfade} hint={t.crossfadeHint}>
          <input className="range" type="range" min={0} max={12} step={1} value={s.crossfade} onChange={(e) => set({ crossfade: +e.target.value })} aria-label={t.crossfade} />
          <span className="tabular" style={{ width: 40, textAlign: 'right' }}>{s.crossfade ? `${s.crossfade} s` : t.sleepOff}</span>
        </Row>
        <Row label={t.autoGain} hint={t.autoGainHint}><Switch label={t.autoGain} on={s.autoGain} set={(autoGain) => set({ autoGain })} /></Row>
        <Row label={t.equalizer} hint={t.eqHint}>
          <Seg value={Object.entries(EQ_PRESETS).find(([, v]) => v.join() === s.eq.join())?.[0] ?? ''} options={Object.keys(EQ_PRESETS).map((k) => [k, k] as const)} set={(k) => set({ eq: EQ_PRESETS[k] })} />
        </Row>
        <div style={{ justifyContent: 'center' }}>
          <div className="eq">{EQ_BANDS.map((f, i) => (
            <label key={f} className="eq-band">
              <span className="tabular">{s.eq[i] > 0 ? '+' : ''}{s.eq[i]} dB</span>
              <input type="range" min={-12} max={12} step={1} value={s.eq[i]} onChange={(e) => set({ eq: s.eq.map((x, j) => (j === i ? +e.target.value : x)) })} aria-label={`${f} Hz`} />
              <span>{f >= 1000 ? `${f / 1000}k` : f}</span>
            </label>
          ))}</div>
        </div>
      </div>

      <h2>{t.playback}</h2>
      <div className="group">
        <Row label={`${t.smartShuffle}: ${t.shuffleMode}`}>
          <Seg value={s.shuffleMode} options={[['random', t.modeRandom], ['genre', t.modeGenre], ['mood', t.modeMood], ['tempo', t.modeTempo]] as const} set={(shuffleMode) => { set({ shuffleMode }); reshuffleUpNext() }} />
        </Row>
        <Row label={t.artistGap}><Seg value={s.artistGap} options={[[1, '1'], [2, '2'], [3, '3'], [5, '5'], [8, '8']] as const} set={(artistGap) => set({ artistGap })} /></Row>
        <Row label={t.smartRadio} hint={t.smartRadioHint}><Switch label={t.smartRadio} on={s.smartRadio} set={(smartRadio) => set({ smartRadio })} /></Row>
        <Row label={t.djVoice} hint={t.djVoiceHint}><Switch label={t.djVoice} on={s.djVoice} set={(djVoice) => set({ djVoice })} /></Row>
      </div>

      <h2>{t.integrations}</h2>
      <div className="group">
        <Row label={t.ytm} hint={t.ytmHint}><button className="btn primary" onClick={() => api.ytmOpen()}>{t.openYtm}</button></Row>
        <Row label={`${t.ytKey} (${t.optional})`} hint={<>{t.ytKeyHint} <b className="tabular">{searches} {t.searchesToday}</b></>}><KeyField name="youtube_key" isSet={st.youtube} placeholder="AIza…" /></Row>
        <Row label={t.aiProvider} hint={t.connectAiHint}>
          <select className="chip" style={{ height: 34, minWidth: 220 }} value={s.aiPreset} onChange={(e) => preset(e.target.value as keyof typeof AI_PRESETS)} aria-label={t.aiProvider}>
            {(Object.keys(AI_PRESETS) as (keyof typeof AI_PRESETS)[]).map((k) => <option key={k} value={k}>{AI_PRESETS[k].label}</option>)}
          </select>
        </Row>
        <Row label={t.aiKey} hint={st.ai_base.includes('localhost') ? t.localNoKey : undefined}><KeyField name="ai_key" isSet={st.ai && !st.ai_base.includes('localhost')} /></Row>
        <form key={st.ai_base + st.ai_model} onSubmit={async (e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          await api.configSet({ ai_base: String(f.get('base') ?? ''), ai_model: String(f.get('model') ?? '') }).catch(() => {})
          refreshStatus(); toast(t.keySaved)
        }} style={{ display: 'flex', flexDirection: 'column' }}>
          <Row label={t.baseUrl}>
            <label className="field" style={{ height: 34, width: 320 }}><input name="base" defaultValue={st.ai_base} placeholder="https://…/v1" aria-label={t.baseUrl} /></label>
          </Row>
          <Row label={t.aiModel}>
            <label className="field" style={{ height: 34, width: 240 }}><input name="model" list="ai-models" defaultValue={st.ai_model} aria-label={t.aiModel} /></label>
            <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
            <button className="btn" style={{ height: 34 }} type="button" onClick={fetchModels}>{t.fetchModels}</button>
            <button className="btn" style={{ height: 34 }} type="submit">{t.save}</button>
            <button className="btn" style={{ height: 34 }} type="button" disabled={!st.ai || testing === 'busy'} onClick={async () => {
              setTesting('busy')
              try { await api.ai([{ role: 'user', content: 'Reply with OK.' }]); setTesting('ok') } catch (e) { setTesting(errText(e, sv)) }
            }}>{testing === 'ok' ? <><CheckCircle size={15} weight="fill" color="#34c759" />{t.works}</> : t.test}</button>
          </Row>
        </form>
        {testing && testing !== 'ok' && testing !== 'busy' && <div><span className="hint" style={{ color: 'var(--accent)' }}>{testing}</span></div>}
        <Row label={t.spotifyKeys} hint={t.spotifyHint}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><KeyField name="spotify_id" isSet={st.spotify} placeholder="Client ID" /><KeyField name="spotify_secret" isSet={st.spotify} placeholder="Client Secret" /></div>
        </Row>
        <Row label={t.discord} hint={t.discordHint}>
          <label className="field" style={{ width: 220, height: 34 }}><input value={s.discordId} onChange={(e) => set({ discordId: e.target.value.replace(/\D/g, '') })} placeholder="123456789012345678" inputMode="numeric" aria-label={t.discord} /></label>
        </Row>
        <Row label={t.addLocal}><button className="btn" onClick={() => addLocalFolder(sv)}><FolderPlus size={16} />{t.addLocal}</button></Row>
      </div>

      <h2>{t.appearance}</h2>
      <div className="group">
        <Row label={t.language}><Seg value={s.lang} options={Object.entries(LANGS) as [typeof s.lang, string][]} set={(lang) => set({ lang })} /></Row>
        <Row label={t.theme}><Seg value={s.theme} options={[['system', t.system], ['dark', t.dark], ['light', t.light]] as const} set={(theme) => set({ theme })} /></Row>
        <Row label={t.accent}>
          {Object.entries(ACCENTS).map(([k, c]) => <button key={k} className="swatch" aria-label={k} aria-pressed={s.accent === k} style={{ background: c, color: c }} onClick={() => set({ accent: k as typeof s.accent })} />)}
        </Row>
        <Row label={t.visuals} hint={t.visualsHint}><Switch label={t.visuals} on={s.visuals} set={(visuals) => set({ visuals })} /></Row>
        <Row label={t.wordSync}><Switch label={t.wordSync} on={s.wordSync} set={(wordSync) => set({ wordSync })} /></Row>
        <Row label={t.lyricsOffset} hint={`${s.lyricsOffset > 0 ? '+' : ''}${s.lyricsOffset.toFixed(1)} s`}>
          <button className="btn" onClick={() => set({ lyricsOffset: +(s.lyricsOffset - 0.1).toFixed(1) })}>−0.1</button>
          <button className="btn" onClick={() => set({ lyricsOffset: 0 })}>0</button>
          <button className="btn" onClick={() => set({ lyricsOffset: +(s.lyricsOffset + 0.1).toFixed(1) })}>+0.1</button>
        </Row>
      </div>

      <h2>{t.privacy}</h2>
      <div className="group">
        <Row label={t.privateSession} hint={t.privateHint}><Switch label={t.privateSession} on={s.privateSession} set={(privateSession) => set({ privateSession })} /></Row>
        <Row label={t.hiddenSongs}>
          {lib.hidden.length ? lib.hidden.slice(0, 6).map((id) => <button key={id} className="chip" onClick={() => library.hide(id)}>{lib.tracks[id]?.title ?? id} ×</button>) : <span className="faint">{t.none}</span>}
        </Row>
        <Row label={t.bannedArtists}>
          {lib.banned.length ? lib.banned.map((a) => <button key={a} className="chip" onClick={() => library.ban(a)}>{a} ×</button>) : <span className="faint">{t.none}</span>}
        </Row>
        <Row label={t.storage} hint={t.storageHint}><span className="faint tabular">{(JSON.stringify(lib).length / 1024).toFixed(0)} KB</span></Row>
      </div>

      <h2>{t.shortcuts}</h2>
      <div className="group">{SHORTCUTS.map(([k, a, b]) => <Row key={k} label={sv ? a : b}><kbd>{k}</kbd></Row>)}</div>
      <p className="faint" style={{ fontSize: 12, marginTop: 24 }}>Echo · YouTube Data API & IFrame Player · LRCLIB · Mistral / DeepSeek</p>
    </div>
  )
}
