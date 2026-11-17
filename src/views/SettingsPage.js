import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CheckCircle, FolderPlus, XCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { toast } from '../components/ui';
import { UpdateCard } from '../components/UpdateCard';
import { api, errText } from '../lib/api';
import { LANGS, useT } from '../lib/i18n';
import { SHORTCUTS } from '../store/bridge';
import { library, useLibrary } from '../store/library';
import { reshuffleUpNext } from '../store/player';
import { ACCENTS, AI_PRESETS, EQ_BANDS, EQ_PRESETS, useSettings } from '../store/settings';
import { refreshStatus, useStatus } from '../store/status';
import { addLocalFolder } from './Library';
const Switch = ({ on, set, label }) => _jsx("button", { className: "switch", role: "switch", "aria-checked": on, "aria-label": label, onClick: () => set(!on) });
function Seg({ value, options, set }) {
    return _jsx("div", { className: "seg", children: options.map(([v, l]) => _jsx("button", { "aria-pressed": value === v, onClick: () => set(v), children: l }, String(v))) });
}
const Row = ({ label, hint, children }) => _jsxs("div", { children: [_jsxs("div", { style: { minWidth: 0, flex: 1 }, children: [_jsx("div", { style: { fontWeight: 550 }, children: label }), hint && _jsx("div", { className: "hint", children: hint })] }), _jsx("div", { className: "row-gap", style: { flexWrap: 'nowrap' }, children: children })] });
/** Write-only secret field: shows whether a key is set, never its value. */
function KeyField({ name, isSet, placeholder }) {
    const t = useT();
    const [v, setV] = useState('');
    const save = async () => {
        try {
            await api.configSet({ [name]: v });
            setV('');
            await refreshStatus();
            toast(t.keySaved);
        }
        catch (e) {
            toast(errText(e, useSettings.get().lang === 'sv'));
        }
    };
    return (_jsxs("form", { className: "row-gap", style: { flexWrap: 'nowrap' }, onSubmit: (e) => { e.preventDefault(); save(); }, children: [_jsxs("span", { className: "pill", style: { color: isSet ? 'var(--text)' : undefined }, children: [isSet ? _jsx(CheckCircle, { size: 13, weight: "fill", color: "#34c759" }) : _jsx(XCircle, { size: 13 }), isSet ? t.set : t.notSet] }), _jsx("label", { className: "field key-field", style: { height: 34 }, children: _jsx("input", { type: "password", value: v, onChange: (e) => setV(e.target.value), placeholder: placeholder ?? '••••••••', "aria-label": name, autoComplete: "off" }) }), _jsx("button", { className: "btn", type: "submit", disabled: !v.trim(), style: { height: 34 }, children: t.save })] }));
}
export function SettingsPage() {
    const t = useT();
    const s = useSettings();
    const set = useSettings.set;
    const st = useStatus();
    const lib = useLibrary();
    const sv = s.lang === 'sv';
    const [testing, setTesting] = useState('');
    useEffect(() => { refreshStatus(); }, []);
    const today = new Date().toISOString().slice(0, 10);
    const searches = s.ytSearchesToday[1] === today ? s.ytSearchesToday[0] : 0;
    const [models, setModels] = useState([]);
    const preset = async (k) => {
        set({ aiPreset: k });
        setModels([]);
        setTesting('');
        const p = AI_PRESETS[k];
        await api.configSet({ ai_base: p.base, ai_model: p.model, ai_protocol: p.protocol }).catch(() => { });
        refreshStatus();
    };
    const fetchModels = async () => {
        try {
            const m = await api.aiModels();
            setModels(m);
            if (!m.length)
                toast(t.none);
        }
        catch (e) {
            toast(errText(e, sv));
        }
    };
    return (_jsxs("div", { className: "page settings-page", children: [_jsx("div", { className: "page-head", children: _jsx("h1", { className: "h-page", children: t.settings }) }), _jsx("h2", { children: t.about }), _jsx("div", { className: "group", children: _jsx(UpdateCard, {}) }), _jsx("h2", { children: t.sound }), _jsxs("div", { className: "group", children: [_jsxs(Row, { label: t.crossfade, hint: t.crossfadeHint, children: [_jsx("input", { className: "range", type: "range", min: 0, max: 12, step: 1, value: s.crossfade, onChange: (e) => set({ crossfade: +e.target.value }), "aria-label": t.crossfade }), _jsx("span", { className: "tabular", style: { width: 40, textAlign: 'right' }, children: s.crossfade ? `${s.crossfade} s` : t.sleepOff })] }), _jsx(Row, { label: t.autoGain, hint: t.autoGainHint, children: _jsx(Switch, { label: t.autoGain, on: s.autoGain, set: (autoGain) => set({ autoGain }) }) }), _jsxs("div", { className: "eq-block", children: [_jsx(Row, { label: t.equalizer, hint: t.eqHint, children: _jsx(Seg, { value: Object.entries(EQ_PRESETS).find(([, v]) => v.join() === s.eq.join())?.[0] ?? '', options: Object.keys(EQ_PRESETS).map((k) => [k, k]), set: (k) => set({ eq: EQ_PRESETS[k] }) }) }), _jsx("div", { className: "eq-bands", children: EQ_BANDS.map((f, i) => (_jsxs("label", { className: "eq-band", children: [_jsxs("span", { className: "tabular", children: [s.eq[i] > 0 ? '+' : '', s.eq[i], " dB"] }), _jsx("input", { className: "range", type: "range", min: -12, max: 12, step: 1, value: s.eq[i], onChange: (e) => set({ eq: s.eq.map((x, j) => (j === i ? +e.target.value : x)) }), "aria-label": `${f} Hz` }), _jsxs("span", { children: [f >= 1000 ? `${f / 1000}k` : f, " Hz"] })] }, f))) })] })] }), _jsx("h2", { children: t.playback }), _jsxs("div", { className: "group", children: [_jsx(Row, { label: `${t.smartShuffle}: ${t.shuffleMode}`, children: _jsx(Seg, { value: s.shuffleMode, options: [['random', t.modeRandom], ['genre', t.modeGenre], ['mood', t.modeMood], ['tempo', t.modeTempo]], set: (shuffleMode) => { set({ shuffleMode }); reshuffleUpNext(); } }) }), _jsx(Row, { label: t.artistGap, children: _jsx(Seg, { value: s.artistGap, options: [[1, '1'], [2, '2'], [3, '3'], [5, '5'], [8, '8']], set: (artistGap) => set({ artistGap }) }) }), _jsx(Row, { label: t.smartRadio, hint: t.smartRadioHint, children: _jsx(Switch, { label: t.smartRadio, on: s.smartRadio, set: (smartRadio) => set({ smartRadio }) }) }), _jsx(Row, { label: t.djVoice, hint: t.djVoiceHint, children: _jsx(Switch, { label: t.djVoice, on: s.djVoice, set: (djVoice) => set({ djVoice }) }) })] }), _jsx("h2", { children: t.integrations }), _jsxs("div", { className: "group", children: [_jsx(Row, { label: t.ytm, hint: t.ytmHint, children: _jsx("button", { className: "btn primary", onClick: () => api.ytmOpen(), children: t.openYtm }) }), _jsx(Row, { label: `${t.ytKey} (${t.optional})`, hint: _jsxs(_Fragment, { children: [t.ytKeyHint, " ", _jsxs("b", { className: "tabular", children: [searches, " ", t.searchesToday] })] }), children: _jsx(KeyField, { name: "youtube_key", isSet: st.youtube, placeholder: "AIza\u2026" }) }), _jsx(Row, { label: t.aiProvider, hint: t.connectAiHint, children: _jsx("select", { className: "chip", style: { height: 34, minWidth: 220 }, value: s.aiPreset, onChange: (e) => preset(e.target.value), "aria-label": t.aiProvider, children: Object.keys(AI_PRESETS).map((k) => _jsx("option", { value: k, children: AI_PRESETS[k].label }, k)) }) }), _jsx(Row, { label: t.aiKey, hint: st.ai_base.includes('localhost') ? t.localNoKey : undefined, children: _jsx(KeyField, { name: "ai_key", isSet: st.ai && !st.ai_base.includes('localhost') }) }), _jsxs("form", { onSubmit: async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            await api.configSet({ ai_base: String(f.get('base') ?? ''), ai_model: String(f.get('model') ?? '') }).catch(() => { });
                            refreshStatus();
                            toast(t.keySaved);
                        }, style: { display: 'flex', flexDirection: 'column' }, children: [_jsx(Row, { label: t.baseUrl, children: _jsx("label", { className: "field", style: { height: 34, width: 320 }, children: _jsx("input", { name: "base", defaultValue: st.ai_base, placeholder: "https://\u2026/v1", "aria-label": t.baseUrl }) }) }), _jsxs(Row, { label: t.aiModel, children: [_jsx("label", { className: "field", style: { height: 34, width: 240 }, children: _jsx("input", { name: "model", list: "ai-models", defaultValue: st.ai_model, "aria-label": t.aiModel }) }), _jsx("datalist", { id: "ai-models", children: models.map((m) => _jsx("option", { value: m }, m)) }), _jsx("button", { className: "btn", style: { height: 34 }, type: "button", onClick: fetchModels, children: t.fetchModels }), _jsx("button", { className: "btn", style: { height: 34 }, type: "submit", children: t.save }), _jsx("button", { className: "btn", style: { height: 34 }, type: "button", disabled: !st.ai || testing === 'busy', onClick: async () => {
                                            setTesting('busy');
                                            try {
                                                await api.ai([{ role: 'user', content: 'Reply with OK.' }]);
                                                setTesting('ok');
                                            }
                                            catch (e) {
                                                setTesting(errText(e, sv));
                                            }
                                        }, children: testing === 'ok' ? _jsxs(_Fragment, { children: [_jsx(CheckCircle, { size: 15, weight: "fill", color: "#34c759" }), t.works] }) : t.test })] })] }, st.ai_base + st.ai_model), testing && testing !== 'ok' && testing !== 'busy' && _jsx("div", { children: _jsx("span", { className: "hint", style: { color: 'var(--accent)' }, children: testing }) }), _jsx(Row, { label: t.spotifyKeys, hint: t.spotifyHint, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx(KeyField, { name: "spotify_id", isSet: st.spotify, placeholder: "Client ID" }), _jsx(KeyField, { name: "spotify_secret", isSet: st.spotify, placeholder: "Client Secret" })] }) }), _jsx(Row, { label: t.discord, hint: t.discordHint, children: _jsx("label", { className: "field", style: { width: 220, height: 34 }, children: _jsx("input", { value: s.discordId, onChange: (e) => set({ discordId: e.target.value.replace(/\D/g, '') }), placeholder: "123456789012345678", inputMode: "numeric", "aria-label": t.discord }) }) }), _jsx(Row, { label: t.addLocal, children: _jsxs("button", { className: "btn", onClick: () => addLocalFolder(sv), children: [_jsx(FolderPlus, { size: 16 }), t.addLocal] }) })] }), _jsx("h2", { children: t.appearance }), _jsxs("div", { className: "group", children: [_jsx(Row, { label: t.language, children: _jsx(Seg, { value: s.lang, options: Object.entries(LANGS), set: (lang) => set({ lang }) }) }), _jsx(Row, { label: t.theme, children: _jsx(Seg, { value: s.theme, options: [['system', t.system], ['dark', t.dark], ['light', t.light]], set: (theme) => set({ theme }) }) }), _jsx(Row, { label: t.accent, children: Object.entries(ACCENTS).map(([k, c]) => _jsx("button", { className: "swatch", "aria-label": k, "aria-pressed": s.accent === k, style: { background: c, color: c }, onClick: () => set({ accent: k }) }, k)) }), _jsx(Row, { label: t.visuals, hint: t.visualsHint, children: _jsx(Switch, { label: t.visuals, on: s.visuals, set: (visuals) => set({ visuals }) }) }), _jsx(Row, { label: t.wordSync, children: _jsx(Switch, { label: t.wordSync, on: s.wordSync, set: (wordSync) => set({ wordSync }) }) }), _jsxs(Row, { label: t.lyricsOffset, hint: `${s.lyricsOffset > 0 ? '+' : ''}${s.lyricsOffset.toFixed(1)} s`, children: [_jsx("button", { className: "btn", onClick: () => set({ lyricsOffset: +(s.lyricsOffset - 0.1).toFixed(1) }), children: "\u22120.1" }), _jsx("button", { className: "btn", onClick: () => set({ lyricsOffset: 0 }), children: "0" }), _jsx("button", { className: "btn", onClick: () => set({ lyricsOffset: +(s.lyricsOffset + 0.1).toFixed(1) }), children: "+0.1" })] })] }), _jsx("h2", { children: t.privacy }), _jsxs("div", { className: "group", children: [_jsx(Row, { label: t.privateSession, hint: t.privateHint, children: _jsx(Switch, { label: t.privateSession, on: s.privateSession, set: (privateSession) => set({ privateSession }) }) }), _jsx(Row, { label: t.hiddenSongs, children: lib.hidden.length ? lib.hidden.slice(0, 6).map((id) => _jsxs("button", { className: "chip", onClick: () => library.hide(id), children: [lib.tracks[id]?.title ?? id, " \u00D7"] }, id)) : _jsx("span", { className: "faint", children: t.none }) }), _jsx(Row, { label: t.bannedArtists, children: lib.banned.length ? lib.banned.map((a) => _jsxs("button", { className: "chip", onClick: () => library.ban(a), children: [a, " \u00D7"] }, a)) : _jsx("span", { className: "faint", children: t.none }) }), _jsx(Row, { label: t.storage, hint: t.storageHint, children: _jsxs("span", { className: "faint tabular", children: [(JSON.stringify(lib).length / 1024).toFixed(0), " KB"] }) })] }), _jsx("h2", { children: t.shortcuts }), _jsx("div", { className: "group", children: SHORTCUTS.map(([k, a, b]) => _jsx(Row, { label: sv ? a : b, children: _jsx("kbd", { children: k }) }, k)) }), _jsx("p", { className: "faint", style: { fontSize: 12, marginTop: 24 }, children: "Echo \u00B7 YouTube Data API & IFrame Player \u00B7 LRCLIB \u00B7 Mistral / DeepSeek" })] }));
}
