import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { WifiSlash } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { PlayerBar } from './components/PlayerBar';
import { Sidebar } from './components/Sidebar';
import { TrackMenuHost } from './components/TrackMenu';
import { PromptHost, Toast } from './components/ui';
import { useT } from './lib/i18n';
import { current, usePlayer } from './store/player';
import { useRouter } from './store/router';
import { Discover, Similar } from './views/Discover';
import { Home } from './views/Home';
import { AlbumView, Albums, ArtistView, Artists, LibraryView, Liked, PlaylistView, Playlists } from './views/Library';
import { NowPlaying } from './views/NowPlaying';
import { SettingsPage } from './views/SettingsPage';
import { Stats } from './views/Stats';
import { Studio } from './views/Studio';
function Page() {
    const { stack, pos } = useRouter();
    const r = stack[pos];
    const key = pos + JSON.stringify(r);
    switch (r.name) {
        case 'home': return _jsx(Home, {}, key);
        case 'discover': return _jsx(Discover, {}, key);
        case 'search': return _jsx(Discover, { q: r.q }, key);
        case 'library': return _jsx(LibraryView, {}, key);
        case 'playlists': return _jsx(Playlists, {}, key);
        case 'playlist': return _jsx(PlaylistView, { id: r.id }, key);
        case 'liked': return _jsx(Liked, {}, key);
        case 'artists': return _jsx(Artists, {}, key);
        case 'artist': return _jsx(ArtistView, { name: r.name_ }, key);
        case 'albums': return _jsx(Albums, {}, key);
        case 'album': return _jsx(AlbumView, { k: r.key }, key);
        case 'now': return _jsx(NowPlaying, {}, key);
        case 'studio': return _jsx(Studio, {}, key);
        case 'stats': return _jsx(Stats, {}, key);
        case 'settings': return _jsx(SettingsPage, {}, key);
        case 'similar': return _jsx(Similar, { id: r.id }, key);
    }
}
function useOnline() {
    const [on, setOn] = useState(navigator.onLine);
    useEffect(() => {
        const up = () => setOn(true), down = () => setOn(false);
        addEventListener('online', up);
        addEventListener('offline', down);
        return () => { removeEventListener('online', up); removeEventListener('offline', down); };
    }, []);
    return on;
}
export function App() {
    const t = useT();
    usePlayer((s) => s.index);
    const art = current()?.artwork;
    const online = useOnline();
    const scroller = useRef(null);
    const { pos, stack } = useRouter();
    const onNow = stack[pos].name === 'now';
    useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [pos]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "ambient", "aria-hidden": true, children: art && _jsx("img", { src: art, alt: "" }, art) }), _jsx("div", { className: "grain", "aria-hidden": true }), _jsxs("div", { className: "shell", children: [_jsx(Sidebar, {}), _jsxs("main", { className: 'main' + (onNow ? ' main-now' : ''), children: [_jsx("div", { className: "topbar drag" }), _jsxs("div", { className: "scroll", ref: scroller, children: [!online && _jsxs("div", { className: "banner", role: "status", children: [_jsx(WifiSlash, { size: 18 }), t.error] }), _jsx(Page, {})] })] }), _jsx(PlayerBar, {})] }), _jsx(TrackMenuHost, {}), _jsx(PromptHost, {}), _jsx(Toast, {})] }));
}
