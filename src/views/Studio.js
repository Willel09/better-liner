import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ChatCircleDots, Disc, MagicWand, Play, Playlist as PlaylistIcon, Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import { TrackList } from '../components/TrackList';
import { SkeletonRows, toast } from '../components/ui';
import { analyzeTracks, assistant, buildPlaylist, djSession } from '../lib/ai';
import { api, errText } from '../lib/api';
import { useT } from '../lib/i18n';
import { allTracks, resolve, useLibrary } from '../store/library';
import { current, playQueue, usePlayer } from '../store/player';
import { navigate } from '../store/router';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';
import { ErrorState } from './common';
import { useDj } from './NowPlaying';
function PromptBox({ value, onChange, onSubmit, placeholder, busy, label }) {
    return (_jsxs("form", { className: "prompt-box glass", onSubmit: (e) => { e.preventDefault(); if (value.trim() && !busy)
            onSubmit(); }, children: [_jsx("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, "aria-label": placeholder }), _jsxs("button", { className: "btn primary", disabled: busy || !value.trim(), type: "submit", children: [busy ? _jsx("span", { className: "spin-dot" }) : _jsx(Sparkle, { size: 16, weight: "fill" }), label] })] }));
}
function Builder() {
    const t = useT();
    const [p, setP] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [res, setRes] = useState(null);
    const run = async (prompt = p) => {
        setBusy(true);
        setErr(null);
        try {
            const r = await buildPlaylist(prompt);
            setRes({ id: r.playlist.id, name: r.playlist.name, description: r.description, tracks: r.tracks });
        }
        catch (e) {
            setErr(e);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(PromptBox, { value: p, onChange: setP, onSubmit: () => run(), placeholder: t.builderPrompt, busy: busy, label: busy ? t.generating : t.generate }), _jsx("div", { className: "suggest", children: t.builderExamples.map((x) => _jsx("button", { className: "chip", onClick: () => { setP(x); run(x); }, children: x }, x)) }), busy ? _jsx(SkeletonRows, {}) : err ? _jsx(ErrorState, { error: err }) : res && (_jsxs("section", { children: [_jsxs("div", { className: "page-head", children: [_jsxs("div", { children: [_jsx("h2", { className: "h-page", style: { fontSize: 26 }, children: res.name }), _jsx("p", { children: res.description })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("button", { className: "btn primary", onClick: () => playQueue(res.tracks), children: [_jsx(Play, { size: 16, weight: "fill" }), t.play] }), _jsxs("button", { className: "btn glassy", onClick: () => navigate({ name: 'playlist', id: res.id }), children: [_jsx(PlaylistIcon, { size: 16 }), t.playlists] })] })] }), _jsx(TrackList, { tracks: res.tracks, playlistId: res.id })] }))] }));
}
function Dj() {
    const t = useT();
    const [vibe, setVibe] = useState('');
    const [useLib, setUseLib] = useState(true);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [set, setSet] = useState(null);
    const run = async () => {
        setBusy(true);
        setErr(null);
        try {
            const s = useLibrary.get();
            const seed = useLib ? resolve([...new Set([...s.liked, ...s.history.slice(0, 60)])]).slice(0, 30) : [];
            const r = await djSession(vibe, seed);
            setSet({ tracks: r.tracks, intro: r.intro });
            useDj.set({ intro: r.intro, segues: r.segues, baseIndex: 0 });
            playQueue(r.tracks);
            navigate({ name: 'now' });
        }
        catch (e) {
            setErr(e);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(PromptBox, { value: vibe, onChange: setVibe, onSubmit: run, placeholder: t.djPrompt, busy: busy, label: t.startDj }), _jsxs("label", { className: "row-gap", style: { margin: '12px 4px 24px' }, children: [_jsx("button", { className: "switch", role: "switch", "aria-checked": useLib, onClick: () => setUseLib(!useLib), "aria-label": t.useLibrary }), " ", t.useLibrary] }), busy ? _jsx(SkeletonRows, {}) : err ? _jsx(ErrorState, { error: err }) : set && _jsxs(_Fragment, { children: [_jsx("p", { className: "muted", children: set.intro }), _jsx(TrackList, { tracks: set.tracks })] })] }));
}
function Assistant() {
    const t = useT();
    const [msgs, setMsgs] = useState([]);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const ask = async (text = q) => {
        const history = [...msgs, { role: 'user', content: text }];
        setMsgs(history);
        setQ('');
        setBusy(true);
        try {
            const stats = await api.stats(30).catch(() => null);
            const answer = await assistant(history, stats, current());
            setMsgs([...history, { role: 'assistant', content: answer }]);
        }
        catch (e) {
            setMsgs([...history, { role: 'assistant', content: errText(e, useSettings.get().lang === 'sv') }]);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "chat", "aria-live": "polite", children: [msgs.map((m, i) => _jsx("div", { className: 'bubble ' + (m.role === 'user' ? 'me' : 'ai glass'), children: m.content }, i)), busy && _jsx("div", { className: "bubble ai glass", children: _jsxs("span", { className: "ly-dots", style: { padding: 0 }, children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {})] }) })] }), !msgs.length && _jsx("div", { className: "suggest", children: t.askExamples.map((x) => _jsx("button", { className: "chip", onClick: () => ask(x), children: x }, x)) }), _jsx(PromptBox, { value: q, onChange: setQ, onSubmit: () => ask(), placeholder: t.askPlaceholder, busy: busy, label: "" })] }));
}
function Analysis() {
    const t = useT();
    const feats = useLibrary((s) => s.features);
    const all = allTracks();
    const done = all.filter((x) => feats[x.id]?.mood).length;
    const [prog, setProg] = useState(null);
    const sv = useSettings((s) => s.lang) === 'sv';
    const moods = new Map(), genres = new Map();
    all.forEach((x) => { const f = feats[x.id]; if (f?.mood)
        moods.set(f.mood, (moods.get(f.mood) ?? 0) + 1); if (f?.genre)
        genres.set(f.genre, (genres.get(f.genre) ?? 0) + 1); });
    const bars = (m, label) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => (_jsxs("div", { className: "hbar", children: [_jsx("span", { className: "faint tabular", children: n }), _jsx("div", { className: "lbl", children: label(k) }), _jsx("span", {}), _jsx("div", { className: "meter", children: _jsx("i", { style: { width: `${(n / Math.max(1, done)) * 100}%` } }) })] }, k)));
    return (_jsxs("div", { className: "bento", children: [_jsxs("section", { className: "tile glass span-12", children: [_jsxs("div", { className: "page-head", style: { margin: 0 }, children: [_jsxs("div", { children: [_jsx("b", { children: t.analyzeLibrary }), _jsx("p", { style: { fontSize: 12.5 }, children: t.analyzeHint })] }), _jsxs("button", { className: "btn primary", disabled: !!prog, onClick: async () => {
                                    setProg([0, 1]);
                                    try {
                                        await analyzeTracks(all, (d, n) => setProg([d, n]));
                                        toast(t.analyzed);
                                    }
                                    catch (e) {
                                        toast(errText(e, sv));
                                    }
                                    finally {
                                        setProg(null);
                                    }
                                }, children: [_jsx(MagicWand, { size: 16 }), t.analyzeLibrary] })] }), _jsxs("div", { className: "kpi", children: [done, _jsxs("small", { children: ["/ ", all.length, " ", t.analyzedCount] })] }), prog && _jsx("div", { className: "progress-line", children: _jsx("i", { style: { width: `${(prog[0] / prog[1]) * 100}%` } }) })] }), _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topMoods }), bars(moods, (k) => t.moods[k] ?? k)] }), _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topGenres }), bars(genres, (k) => k)] })] }));
}
export function Studio() {
    const t = useT();
    const st = useStatus();
    usePlayer((s) => s.index);
    const [tab, setTab] = useState('builder');
    const tabs = [['builder', t.builder, PlaylistIcon], ['dj', t.dj, Disc], ['assistant', t.assistant, ChatCircleDots], ['analysis', t.analysis, MagicWand]];
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsxs("div", { children: [_jsx("h1", { className: "h-page", children: t.studio }), st.ai && _jsxs("p", { children: [st.ai_model, " \u00B7 ", new URL(st.ai_base || 'https://x').hostname] })] }) }), _jsx("div", { className: "studio-tabs glass", role: "tablist", children: tabs.map(([k, l, Icon]) => _jsxs("button", { role: "tab", "aria-selected": tab === k, "aria-pressed": tab === k, onClick: () => setTab(k), children: [_jsx(Icon, { size: 16 }), l] }, k)) }), !st.ai ? _jsx(ErrorState, { error: "ai:nokey" }) : tab === 'builder' ? _jsx(Builder, {}) : tab === 'dj' ? _jsx(Dj, {}) : tab === 'assistant' ? _jsx(Assistant, {}) : _jsx(Analysis, {})] }));
}
