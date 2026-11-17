import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { YoutubeLogo, Broadcast, DotsThree, MagicWand, Microphone, MusicNotes, Queue as QueueIcon, Sparkle, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Lyrics } from '../components/Lyrics';
import { Progress, Transport, Volume } from '../components/PlayerBar';
import { Eq, TrackList } from '../components/TrackList';
import { openTrackMenu, startRadio } from '../components/TrackMenu';
import { Empty, fmt, Img, SkeletonRows, toast } from '../components/ui';
import { Visualizer } from '../components/Visualizer';
import { analyzeTracks, similarTo } from '../lib/ai';
import { api, errText } from '../lib/api';
import { useT } from '../lib/i18n';
import { create } from '../store/create';
import { useLibrary } from '../store/library';
import { clearUpNext, current, moveInQueue, playAt, removeFromQueue, usePlayer } from '../store/player';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';
import { ErrorState } from './common';
import { useAsync } from './hooks';
// AI DJ commentary for the running set: intro + lines placed before given queue positions.
export const useDj = create({ intro: '', segues: [], baseIndex: 0 });
function speak(text) {
    if (!useSettings.get().djVoice || !('speechSynthesis' in window))
        return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = useSettings.get().lang === 'sv' ? 'sv-SE' : 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}
function DjCard() {
    const t = useT();
    const dj = useDj();
    const index = usePlayer((s) => s.index);
    const line = index === dj.baseIndex && dj.intro ? dj.intro : dj.segues.find((s) => s.at + dj.baseIndex === index)?.text;
    useEffect(() => { if (line)
        speak(line); }, [line]);
    if (!line)
        return null;
    return (_jsxs("div", { className: "dj-card glass", children: [_jsx(Sparkle, { size: 20, weight: "fill", style: { color: 'var(--accent)', flex: 'none', marginTop: 2 } }), _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: t.djSays }), _jsx("div", { style: { marginTop: 2 }, children: line })] })] }));
}
function QueueList() {
    const t = useT();
    const { queue, index, playing, radioBusy } = usePlayer();
    const [from, setFrom] = useState(null);
    if (!queue.length)
        return _jsx(Empty, { icon: _jsx(QueueIcon, { size: 36, weight: "duotone" }), text: t.nothingPlaying });
    const row = (i) => {
        const tr = queue[i];
        return (_jsxs("div", { className: 'row compact' + (from === i ? ' dragging' : ''), "aria-current": i === index, draggable: i > index, onDragStart: () => setFrom(i), onDragOver: (e) => i > index && e.preventDefault(), onDrop: () => { if (from !== null && from !== i)
                moveInQueue(from, i); setFrom(null); }, onDragEnd: () => setFrom(null), onDoubleClick: () => playAt(i), onContextMenu: (e) => openTrackMenu(e, tr), children: [_jsx("div", { className: "art", children: _jsx(Img, { src: tr.artwork, alt: "" }) }), _jsxs("div", { style: { minWidth: 0 }, children: [_jsxs("div", { className: "rt", children: [tr.source === 'ref' && _jsx("span", { className: "ref-dot" }), tr.title] }), _jsx("div", { className: "ra", children: tr.artist })] }), _jsx("div", { className: "d tabular", children: i === index ? _jsx(Eq, { paused: !playing }) : tr.duration ? fmt(tr.duration) : '' }), i === index
                    ? _jsx("button", { className: "icon-btn sm hide", "aria-label": t.more, onClick: (e) => openTrackMenu(e, tr), children: _jsx(DotsThree, { size: 18, weight: "bold" }) })
                    : _jsx("button", { className: "icon-btn sm hide", "aria-label": t.remove, onClick: () => removeFromQueue(i), children: _jsx(X, { size: 16 }) })] }, tr.id + i));
    };
    return (_jsxs("div", { style: { padding: '4px 8px 16px' }, children: [index >= 0 && _jsxs(_Fragment, { children: [_jsx("div", { className: "eyebrow", style: { padding: '4px 10px' }, children: t.nowPlaying }), row(index)] }), queue.length - index - 1 > 0 && _jsxs("div", { className: "eyebrow", style: { padding: '16px 10px 4px', display: 'flex', justifyContent: 'space-between' }, children: [t.upNext, _jsx("button", { className: "linkish faint", onClick: clearUpNext, children: t.clearQueue })] }), queue.map((_, i) => (i > index ? row(i) : null)), radioBusy && _jsxs("div", { className: "faint", style: { padding: 12, fontSize: 12 }, children: [_jsx(Broadcast, { size: 14, style: { verticalAlign: -2 } }), " ", t.smartRadio, "\u2026"] })] }));
}
function SimilarList() {
    const st = useStatus();
    const tr = current();
    const res = useAsync(() => similarTo(tr, 12), [tr?.id], !!tr && st.ai);
    const why = useMemo(() => Object.fromEntries((res.data ?? []).map((p) => [p.id, p.why ?? ''])), [res.data]);
    if (!st.ai)
        return _jsx(ErrorState, { error: "ai:nokey" });
    if (res.loading)
        return _jsx("div", { style: { padding: 12 }, children: _jsx(SkeletonRows, { n: 6 }) });
    if (res.error)
        return _jsx(ErrorState, { error: res.error, retry: res.retry });
    return _jsx("div", { style: { padding: '4px 8px' }, children: _jsx(TrackList, { tracks: res.data ?? [], why: why, showFeatures: false }) });
}
export function NowPlaying() {
    const t = useT();
    usePlayer((s) => s.index);
    const tr = current();
    const f = useLibrary((s) => (tr ? s.features[tr.id] : undefined));
    const [tab, setTab] = useState('lyrics');
    const sv = useSettings((s) => s.lang) === 'sv';
    if (!tr)
        return _jsx("div", { className: "page", children: _jsx(Empty, { icon: _jsx(MusicNotes, { size: 44, weight: "duotone" }), text: t.nothingPlaying }) });
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "np-bg", "aria-hidden": true, children: _jsx(Visualizer, { art: tr.artwork }) }), _jsxs("div", { className: "page np-page", style: { position: 'relative' }, children: [_jsxs("div", { className: "np-left", children: [_jsx("div", { className: "np-media square", children: _jsx(Img, { src: tr.artwork, alt: tr.title }) }), _jsxs("div", { children: [_jsx("h1", { className: "h-hero", style: { fontSize: 'clamp(28px, 3.2vw, 44px)', color: '#fff' }, children: tr.title }), _jsx("div", { style: { color: 'rgba(255,255,255,0.75)', fontSize: 17, marginTop: 4 }, children: tr.artist }), _jsxs("div", { className: "row-gap", style: { marginTop: 12 }, children: [f?.mood && _jsx("span", { className: "pill accent", children: t.moods[f.mood] ?? f.mood }), (f?.genre || tr.genre) && _jsx("span", { className: "pill", children: f?.genre ?? tr.genre }), f?.bpm ? _jsxs("span", { className: "pill tabular", children: [Math.round(f.bpm), " BPM", f.by === 'local' ? ' ✓' : ''] }) : null, f?.energy !== undefined && _jsxs("span", { className: "pill tabular", children: ["\u26A1 ", Math.round(f.energy * 100), "%"] }), !f?.mood && _jsxs("button", { className: "chip", onClick: () => analyzeTracks([tr]).then(() => toast(t.analyzed), (e) => toast(errText(e, sv))), children: [_jsx(MagicWand, { size: 13 }), " ", t.analyzeNow] }), tr.source !== 'local'
                                                && _jsxs("button", { className: "chip", onClick: () => api.ytmOpen(), children: [_jsx(YoutubeLogo, { size: 13 }), " ", t.openYtm] }), _jsxs("button", { className: "chip", onClick: () => startRadio(tr, sv), children: [_jsx(Broadcast, { size: 13 }), " ", t.startRadio] })] })] }), _jsxs("div", { className: "ctrl glass", style: { borderRadius: 26, padding: '14px 16px 12px', '--glass': 'rgba(255,255,255,0.08)', '--text': '#fff', '--text-2': 'rgba(255,255,255,0.75)', '--text-3': 'rgba(255,255,255,0.6)', '--base': '#111', '--fill-hover': 'rgba(255,255,255,0.12)', '--fill-press': 'rgba(255,255,255,0.22)' }, children: [_jsx(Progress, {}), _jsxs("div", { className: "transport", style: { flexDirection: 'row', justifyContent: 'space-between' }, children: [_jsx(Transport, {}), _jsx("div", { className: "vol", children: _jsx(Volume, {}) })] })] }), _jsx(DjCard, {})] }), _jsxs("section", { className: "np-right glass", children: [_jsx("div", { className: "seg-tabs", role: "tablist", children: [['lyrics', t.lyrics, Microphone], ['queue', t.queue, QueueIcon], ['similar', t.similar, Sparkle]].map(([k, l, Icon]) => (_jsxs("button", { role: "tab", className: "chip", "aria-pressed": tab === k, "aria-selected": tab === k, onClick: () => setTab(k), children: [_jsx(Icon, { size: 14, style: { verticalAlign: -2 } }), " ", l] }, k))) }), _jsx("div", { className: "panel-body", children: tab === 'lyrics' ? _jsx(Lyrics, { big: true }) : tab === 'queue' ? _jsx(QueueList, {}) : _jsx(SimilarList, {}) })] })] })] }));
}
