import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BookmarkSimple, Broadcast, EyeSlash, Heart, ListPlus, MagicWand, Playlist as PlaylistIcon, Prohibit, Queue, Sparkle, User, X } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { analyzeTracks, similarTo } from '../lib/ai';
import { errText } from '../lib/api';
import { useT } from '../lib/i18n';
import { primaryArtist } from '../lib/tracks';
import { create } from '../store/create';
import { library, useLibrary } from '../store/library';
import { enqueue, playQueue } from '../store/player';
import { navigate } from '../store/router';
import { useSettings } from '../store/settings';
import { prompt, toast } from './ui';
const useMenu = create({ req: null });
export const openTrackMenu = (e, track, playlistId) => {
    e.preventDefault?.();
    useMenu.set({ req: { x: e.clientX, y: e.clientY, track, playlistId } });
};
export async function startRadio(t, sv) {
    toast(sv ? 'Startar radio…' : 'Starting radio…');
    try {
        playQueue([t, ...(await similarTo(t, 15))]);
    }
    catch (e) {
        toast(errText(e, sv));
    }
}
export function TrackMenuHost() {
    const req = useMenu((s) => s.req);
    const t = useT();
    const sv = useSettings((s) => s.lang) === 'sv';
    const { liked, playlists, saved } = useLibrary();
    const ref = useRef(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const close = () => useMenu.set({ req: null });
    useLayoutEffect(() => {
        if (!req || !ref.current)
            return;
        const r = ref.current.getBoundingClientRect();
        setPos({ x: Math.max(8, Math.min(req.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(req.y, innerHeight - r.height - 8)) });
        ref.current.querySelector('button')?.focus();
    }, [req]);
    useEffect(() => {
        if (!req)
            return;
        const off = (e) => { if (!ref.current?.contains(e.target))
            close(); };
        const key = (e) => {
            if (e.key === 'Escape')
                close();
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const items = [...ref.current.querySelectorAll('button')];
                const i = items.indexOf(document.activeElement);
                items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
                e.preventDefault();
            }
        };
        addEventListener('mousedown', off);
        addEventListener('keydown', key, true);
        return () => { removeEventListener('mousedown', off); removeEventListener('keydown', key, true); };
    }, [req]);
    if (!req)
        return null;
    const tr = req.track;
    const act = (fn) => () => { close(); fn(); };
    const isLiked = liked.includes(tr.id);
    return (_jsxs("div", { ref: ref, className: "menu glass", role: "menu", style: { left: pos.x, top: pos.y }, children: [_jsxs("button", { role: "menuitem", onClick: act(() => enqueue([tr], true)), children: [_jsx(Queue, { size: 17 }), t.playNext] }), _jsxs("button", { role: "menuitem", onClick: act(() => enqueue([tr])), children: [_jsx(ListPlus, { size: 17 }), t.addToQueue] }), _jsxs("button", { role: "menuitem", onClick: act(() => library.toggleLike(tr)), children: [_jsx(Heart, { size: 17, weight: isLiked ? 'fill' : 'regular' }), isLiked ? t.unlike : t.like] }), !saved.includes(tr.id) && _jsxs("button", { role: "menuitem", onClick: act(() => { library.save([tr]); toast(t.savedToLibrary); }), children: [_jsx(BookmarkSimple, { size: 17 }), t.saveToLibrary] }), _jsx("hr", {}), _jsxs("button", { role: "menuitem", onClick: act(() => startRadio(tr, sv)), children: [_jsx(Broadcast, { size: 17 }), t.startRadio] }), _jsxs("button", { role: "menuitem", onClick: act(() => navigate({ name: 'similar', id: tr.id })), children: [_jsx(Sparkle, { size: 17 }), t.similar] }), _jsxs("button", { role: "menuitem", onClick: act(() => analyzeTracks([tr]).then(() => toast(t.analyzed), (e) => toast(errText(e, sv)))), children: [_jsx(MagicWand, { size: 17 }), t.analyze] }), _jsx("hr", {}), _jsx("div", { className: "sub-label", children: t.addToPlaylist }), playlists.filter((p) => !p.smart).slice(0, 8).map((p) => (_jsxs("button", { role: "menuitem", onClick: act(() => { library.addToPlaylist(p.id, [tr]); toast(p.name); }), children: [_jsx(PlaylistIcon, { size: 17 }), p.name] }, p.id))), _jsxs("button", { role: "menuitem", onClick: act(async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n)
                    library.createPlaylist(n, [tr.id]); }), children: [_jsx(ListPlus, { size: 17 }), t.newPlaylist, "\u2026"] }), req.playlistId && _jsxs("button", { role: "menuitem", onClick: act(() => library.removeFromPlaylist(req.playlistId, tr.id)), children: [_jsx(X, { size: 17 }), t.removeFromPlaylist] }), _jsx("hr", {}), _jsxs("button", { role: "menuitem", onClick: act(() => navigate({ name: 'artist', name_: primaryArtist(tr.artist) })), children: [_jsx(User, { size: 17 }), t.goToArtist] }), _jsxs("button", { role: "menuitem", onClick: act(() => { library.hide(tr.id); toast(t.hidden); }), children: [_jsx(EyeSlash, { size: 17 }), t.hideSong] }), _jsxs("button", { role: "menuitem", onClick: act(() => { library.ban(primaryArtist(tr.artist)); toast(t.banned); }), children: [_jsx(Prohibit, { size: 17 }), t.banArtist] })] }));
}
