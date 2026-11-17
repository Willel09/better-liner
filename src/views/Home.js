import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ClockCounterClockwise, Play } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Card, Img } from '../components/ui';
import { useT } from '../lib/i18n';
import { smartShuffle } from '../lib/shuffle';
import { allTracks, resolve, useLibrary } from '../store/library';
import { playQueue } from '../store/player';
import { navigate } from '../store/router';
import { ConnectCards } from './common';
/** "Made for you" mixes built locally from the library: per mood, per top artist cluster, and a daily mix. */
export function useMixes() {
    const t = useT();
    const s = useLibrary();
    return useMemo(() => {
        const lib = allTracks();
        if (lib.length < 4)
            return [];
        const out = [];
        const day = new Date().toDateString();
        let seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
        const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const fav = [...lib].sort((a, b) => (s.plays[b.id] ?? 0) - (s.plays[a.id] ?? 0) + (s.liked.includes(b.id) ? 2 : 0) - (s.liked.includes(a.id) ? 2 : 0));
        out.push({ id: 'daily', name: 'Daily Mix', sub: [...new Set(fav.slice(0, 12).map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(fav.slice(0, 50), { rand, features: s.features }) });
        const byMood = new Map();
        lib.forEach((x) => { const m = s.features[x.id]?.mood; if (m)
            byMood.set(m, [...(byMood.get(m) ?? []), x]); });
        [...byMood].filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length).slice(0, 4).forEach(([mood, v]) => {
            const label = t.moods[mood] ?? mood;
            out.push({ id: 'mood:' + mood, name: label[0].toUpperCase() + label.slice(1) + ' mix', sub: [...new Set(v.map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(v, { rand, features: s.features, mode: 'tempo' }) });
        });
        const old = lib.filter((x) => (s.plays[x.id] ?? 0) <= 1);
        if (old.length >= 6)
            out.push({ id: 'rediscover', name: t.rediscover, sub: [...new Set(old.map((x) => x.artist))].slice(0, 3).join(', '), tracks: smartShuffle(old, { rand }).slice(0, 40) });
        return out;
    }, [s.tracks, s.features, s.plays, s.liked, t]);
}
export function MixCard({ mix }) {
    const arts = [...new Set(mix.tracks.map((x) => x.artwork).filter(Boolean))].slice(0, 4);
    return (_jsxs("button", { className: "mix", onClick: () => playQueue(mix.tracks), "aria-label": mix.name, children: [_jsx("div", { className: "grid4", children: [0, 1, 2, 3].map((i) => arts[i % Math.max(1, arts.length)] ? _jsx("img", { src: arts[i % arts.length], alt: "" }, i) : _jsx("div", { style: { background: 'var(--fill-press)' } }, i)) }), _jsxs("div", { children: [_jsx("b", { children: mix.name }), _jsx("span", { children: mix.sub })] })] }));
}
export function Home() {
    const t = useT();
    const history = useLibrary((s) => s.history);
    const playlists = useLibrary((s) => s.playlists);
    const tracks = useLibrary((s) => s.tracks);
    const recent = useMemo(() => resolve(history.slice(0, 14)), [history]);
    const mixes = useMixes();
    const hour = new Date().getHours();
    const greet = hour < 11 ? t.morning : hour < 18 ? t.afternoon : t.evening;
    const last = recent[0];
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsx("h1", { className: "h-page", style: { fontSize: 34 }, children: greet }) }), _jsx(ConnectCards, {}), _jsx("div", { className: "bento", children: _jsx("section", { className: "tile glass span-12", style: { minHeight: 250, padding: 0 }, children: last ? _jsxs(_Fragment, { children: [last.artwork && _jsx("img", { src: last.artwork, alt: "", style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(36px) saturate(150%)', opacity: 0.55, transform: 'scale(1.2)' } }), _jsxs("div", { style: { position: 'relative', display: 'flex', gap: 22, padding: 22, alignItems: 'center', height: '100%' }, children: [_jsx("div", { className: "cover", style: { width: 180, flex: 'none' }, children: _jsx(Img, { src: last.artwork, alt: last.title }) }), _jsxs("div", { style: { minWidth: 0 }, children: [_jsxs("div", { className: "eyebrow", children: [_jsx(ClockCounterClockwise, { size: 13, style: { verticalAlign: -2 } }), " ", t.recent] }), _jsx("h2", { className: "h-hero", style: { fontSize: 'clamp(26px, 3vw, 40px)', margin: '8px 0 4px' }, children: last.title }), _jsx("div", { className: "muted", style: { fontSize: 15 }, children: last.artist }), _jsxs("button", { className: "btn primary", style: { marginTop: 16 }, onClick: () => playQueue(recent, 0), children: [_jsx(Play, { size: 16, weight: "fill" }), t.play] })] })] })] }) : _jsxs("div", { style: { padding: 22 }, children: [_jsx("div", { className: "eyebrow", children: t.recent }), _jsx("p", { className: "muted", children: t.libraryEmpty }), _jsx("button", { className: "btn primary", onClick: () => navigate({ name: 'discover' }), children: t.discover })] }) }) }), mixes.length > 0 && _jsxs(_Fragment, { children: [_jsx("h2", { className: "h-sec", children: t.madeForYou }), _jsx("div", { className: "shelf", children: mixes.map((m) => _jsx(MixCard, { mix: m }, m.id)) })] }), recent.length > 1 && _jsxs(_Fragment, { children: [_jsx("h2", { className: "h-sec", children: t.recent }), _jsx("div", { className: "shelf", children: recent.map((tr, i) => _jsx(Card, { title: tr.title, sub: tr.artist, art: tr.artwork, onOpen: () => playQueue(recent, i), onPlay: () => playQueue(recent, i) }, tr.id)) })] }), playlists.length > 0 && _jsxs(_Fragment, { children: [_jsx("h2", { className: "h-sec", children: t.yourPlaylists }), _jsx("div", { className: "shelf", children: playlists.slice(-12).reverse().map((p) => (_jsx(Card, { title: p.name, sub: `${p.trackIds.length} ${t.songs}`, art: tracks[p.trackIds[0]]?.artwork ?? null, onOpen: () => navigate({ name: 'playlist', id: p.id }), onPlay: () => playQueue(resolve(p.trackIds)) }, p.id))) })] })] }));
}
