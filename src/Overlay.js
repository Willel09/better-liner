import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Heart, Pause, Play, SkipBack, SkipForward, X } from '@phosphor-icons/react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { Img } from './components/ui';
import { emit, listen } from './lib/api';
// Floating always-on-top mini player window. It only shows state and sends commands;
// playback stays in the main window.
export function Mini() {
    const [s, setS] = useState({ track: null, playing: false, position: 0, duration: 0, liked: false });
    useEffect(() => {
        const off = listen('player:state', setS);
        emit('player:command', 'hello');
        return off;
    }, []);
    const cmd = (c) => emit('player:command', c);
    const tr = s.track;
    return (_jsxs("div", { className: "overlay glass strong", "data-tauri-drag-region": true, onMouseDown: (e) => { if (e.target === e.currentTarget)
            getCurrentWindow().startDragging(); }, children: [_jsx("div", { className: "art", children: _jsx(Img, { src: tr?.artwork, alt: tr?.title ?? '' }) }), _jsxs("div", { style: { minWidth: 0 }, "data-tauri-drag-region": true, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 6 }, "data-tauri-drag-region": true, children: [_jsxs("div", { style: { minWidth: 0 }, "data-tauri-drag-region": true, children: [_jsx("div", { style: { fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: tr?.title ?? 'Echo' }), _jsx("div", { className: "muted", style: { fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: tr?.artist ?? '' })] }), _jsx("button", { className: "icon-btn sm", style: { width: 28, height: 28, marginTop: -4 }, "aria-label": "Close", onClick: () => getCurrentWindow().close(), children: _jsx(X, { size: 14 }) })] }), _jsxs("div", { className: "btns", children: [_jsx("button", { className: "icon-btn sm", "aria-label": "Like", "aria-pressed": s.liked, onClick: () => cmd('like'), children: _jsx(Heart, { size: 16, weight: s.liked ? 'fill' : 'regular' }) }), _jsx("button", { className: "icon-btn sm", "aria-label": "Previous", onClick: () => cmd('prev'), children: _jsx(SkipBack, { size: 18, weight: "fill" }) }), _jsx("button", { className: "icon-btn", "aria-label": s.playing ? 'Pause' : 'Play', onClick: () => cmd('toggle'), children: s.playing ? _jsx(Pause, { size: 22, weight: "fill" }) : _jsx(Play, { size: 22, weight: "fill" }) }), _jsx("button", { className: "icon-btn sm", "aria-label": "Next", onClick: () => cmd('next'), children: _jsx(SkipForward, { size: 18, weight: "fill" }) })] }), _jsx("div", { className: "mini-prog", children: _jsx("i", { style: { width: `${s.duration ? (s.position / s.duration) * 100 : 0}%` } }) })] })] }));
}
