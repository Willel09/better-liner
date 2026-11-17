import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { YoutubeLogo, Books, CaretLeft, CaretRight, ChartBar, Compass, Disc, GearSix, Heart, House, MicrophoneStage, MusicNotes, Playlist as PlaylistIcon, Sparkle, Waveform } from '@phosphor-icons/react';
import { api, isTauri } from '../lib/api';
import { useT } from '../lib/i18n';
import { useLibrary } from '../store/library';
import { current, usePlayer, useYtm } from '../store/player';
import { back, forward, navigate, useRouter } from '../store/router';
import { useSettings } from '../store/settings';
import { Img } from './ui';
function Item({ to, icon, label, cur }) {
    const active = JSON.stringify(cur) === JSON.stringify(to);
    return _jsxs("button", { className: "side-item", "aria-current": active ? 'page' : undefined, onClick: () => navigate(to), children: [icon, _jsx("span", { children: label })] });
}
export function Sidebar() {
    const t = useT();
    const { stack, pos } = useRouter();
    const cur = stack[pos];
    const playlists = useLibrary((s) => s.playlists);
    const tracks = useLibrary((s) => s.tracks);
    const priv = useSettings((s) => s.privateSession);
    usePlayer((s) => s.index);
    const np = current();
    const ytmOpen = useYtm((s) => s.open);
    const ic = { size: 19 };
    return (_jsxs("aside", { className: "sidebar glass drag", "aria-label": "Sidebar", children: [_jsxs("div", { style: { position: 'absolute', top: 12, right: 10, display: 'flex' }, children: [_jsx("button", { className: "icon-btn sm", "aria-label": t.back, disabled: pos === 0, onClick: back, children: _jsx(CaretLeft, { size: 16, weight: "bold" }) }), _jsx("button", { className: "icon-btn sm", "aria-label": t.forward, disabled: pos >= stack.length - 1, onClick: forward, children: _jsx(CaretRight, { size: 16, weight: "bold" }) })] }), _jsxs("nav", { className: "no-drag", "aria-label": "Main", children: [_jsx(Item, { cur: cur, to: { name: 'home' }, icon: _jsx(House, { ...ic }), label: t.home }), _jsx(Item, { cur: cur, to: { name: 'discover' }, icon: _jsx(Compass, { ...ic }), label: t.discover }), _jsx(Item, { cur: cur, to: { name: 'now' }, icon: _jsx(Waveform, { ...ic }), label: t.now }), _jsx(Item, { cur: cur, to: { name: 'studio' }, icon: _jsx(Sparkle, { ...ic }), label: t.studio }), isTauri && _jsxs("button", { className: "side-item", "aria-pressed": ytmOpen, onClick: () => api.ytmOpen(), children: [_jsx(YoutubeLogo, { ...ic, weight: ytmOpen ? 'fill' : 'regular' }), _jsx("span", { children: t.ytm })] })] }), _jsx("div", { className: "side-label", children: t.yourMusic }), _jsxs("nav", { className: "no-drag", "aria-label": t.yourMusic, children: [_jsx(Item, { cur: cur, to: { name: 'library' }, icon: _jsx(Books, { ...ic }), label: t.library }), _jsx(Item, { cur: cur, to: { name: 'playlists' }, icon: _jsx(PlaylistIcon, { ...ic }), label: t.playlists }), _jsx(Item, { cur: cur, to: { name: 'artists' }, icon: _jsx(MicrophoneStage, { ...ic }), label: t.artists }), _jsx(Item, { cur: cur, to: { name: 'albums' }, icon: _jsx(Disc, { ...ic }), label: t.albums }), _jsx(Item, { cur: cur, to: { name: 'liked' }, icon: _jsx(Heart, { ...ic }), label: t.liked }), _jsx(Item, { cur: cur, to: { name: 'stats' }, icon: _jsx(ChartBar, { ...ic }), label: t.stats })] }), _jsx("div", { className: "side-scroll no-drag", children: playlists.slice(0, 30).map((p) => (_jsx(Item, { cur: cur, to: { name: 'playlist', id: p.id }, label: p.name, icon: _jsx("span", { className: "thumb", children: p.trackIds[0] ? _jsx(Img, { src: tracks[p.trackIds[0]]?.artwork, alt: "" }) : _jsx(MusicNotes, { size: 14 }) }) }, p.id))) }), np && cur.name !== 'now' && (_jsx("div", { className: "tile-slot no-drag", onClick: () => navigate({ name: 'now' }), role: "button", "aria-label": t.now, tabIndex: 0, children: _jsx(Img, { src: np.artwork, alt: np.title }) })), _jsxs("div", { className: "no-drag", style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }, children: [_jsx(Item, { cur: cur, to: { name: 'settings' }, icon: _jsx(GearSix, { ...ic }), label: t.settings }), priv && _jsx("span", { className: "pill accent", title: t.privateHint, children: t.privateSession })] })] }));
}
