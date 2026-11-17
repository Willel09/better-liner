import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowCounterClockwise, Key, Play, Shuffle, Sparkle, WifiSlash, YoutubeLogo } from '@phosphor-icons/react';
import { api, isTauri } from '../lib/api';
import { useYtm } from '../store/player';
import { Empty, Img } from '../components/ui';
import { errText } from '../lib/api';
import { useT } from '../lib/i18n';
import { playQueue, toggleShuffle, usePlayer } from '../store/player';
import { navigate } from '../store/router';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';
export function ErrorState({ error, retry }) {
    const t = useT();
    const sv = useSettings((s) => s.lang) === 'sv';
    const msg = errText(error, sv);
    const needsKey = /nokey|nyckel|key/i.test(String(error?.message ?? error));
    return (_jsx(Empty, { icon: needsKey ? _jsx(Key, { size: 40, weight: "duotone" }) : _jsx(WifiSlash, { size: 40, weight: "duotone" }), text: msg, children: needsKey ? _jsx("button", { className: "btn", onClick: () => navigate({ name: 'settings' }), children: t.openSettings })
            : retry && _jsxs("button", { className: "btn", onClick: retry, children: [_jsx(ArrowCounterClockwise, { size: 16 }), t.retry] }) }));
}
export function PlayActions({ tracks, children }) {
    const t = useT();
    return (_jsxs("div", { className: "actions", children: [_jsx("button", { className: "play-fab", "aria-label": t.play, disabled: !tracks.length, onClick: () => { if (usePlayer.get().shuffle)
                    toggleShuffle(); playQueue(tracks); }, children: _jsx(Play, { size: 22, weight: "fill" }) }), _jsxs("button", { className: "btn glassy", disabled: !tracks.length, onClick: () => { if (!usePlayer.get().shuffle)
                    toggleShuffle(); playQueue(tracks, Math.floor(Math.random() * tracks.length)); }, children: [_jsx(Shuffle, { size: 16, weight: "bold" }), t.shuffle] }), children] }));
}
export function CollectionHeader({ title, sub, art, kind, children }) {
    return (_jsxs("header", { className: "hero", children: [_jsx("div", { className: "cover", children: typeof art === 'string' || art === null ? _jsx(Img, { src: art, alt: title }) : art }), _jsxs("div", { className: "meta", children: [_jsx("div", { className: "eyebrow", children: kind }), _jsx("h1", { className: "h-hero", children: title }), _jsx("div", { className: "muted", children: sub }), children] })] }));
}
/** Cards prompting the user to connect YouTube / AI when missing. */
export function ConnectCards() {
    const t = useT();
    const st = useStatus();
    const ytmOpen = useYtm((s) => s.open);
    const showYt = !st.youtube && !ytmOpen && isTauri;
    if (!showYt && st.ai)
        return null;
    return (_jsxs("div", { className: "bento", style: { marginBottom: 14 }, children: [showYt && (_jsxs("div", { className: "notice glass span-6", children: [_jsx("div", { className: "ico", children: _jsx(YoutubeLogo, { size: 24, weight: "fill" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("b", { children: t.connectYt }), _jsx("div", { className: "muted", style: { fontSize: 12.5 }, children: t.connectYtHint })] }), _jsx("button", { className: "btn primary", onClick: () => api.ytmOpen(), children: t.openYtm })] })), !st.ai && (_jsxs("div", { className: "notice glass span-6", children: [_jsx("div", { className: "ico", children: _jsx(Sparkle, { size: 24, weight: "fill" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("b", { children: t.connectAi }), _jsx("div", { className: "muted", style: { fontSize: 12.5 }, children: t.connectAiHint })] }), _jsx("button", { className: "btn", onClick: () => navigate({ name: 'settings' }), children: t.openSettings })] }))] }));
}
export const totalMin = (ts) => Math.round(ts.reduce((a, x) => a + (x.duration || 0), 0) / 60);
