import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { DotsThree, Heart, Play } from '@phosphor-icons/react';
import { useState } from 'react';
import { useT } from '../lib/i18n';
import { primaryArtist } from '../lib/tracks';
import { library, useLibrary } from '../store/library';
import { current, playQueue, toggle, usePlayer } from '../store/player';
import { navigate } from '../store/router';
import { openTrackMenu } from './TrackMenu';
import { fmt, Img } from './ui';
export function Eq({ paused }) {
    return _jsxs("span", { className: 'eq' + (paused ? ' paused' : ''), "aria-hidden": true, children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {})] });
}
export function TrackList({ tracks, playlistId, onReorder, showFeatures = true, why }) {
    const t = useT();
    const liked = useLibrary((s) => s.liked);
    const feats = useLibrary((s) => s.features);
    usePlayer((s) => s.index);
    const playing = usePlayer((s) => s.playing);
    const nowId = current()?.id;
    const [dragFrom, setDragFrom] = useState(null);
    const [dropAt, setDropAt] = useState(null);
    return (_jsx("div", { className: "rows", role: "list", children: tracks.map((tr, i) => {
            const isNow = tr.id === nowId;
            const isLiked = liked.includes(tr.id);
            const f = feats[tr.id];
            const go = () => (isNow ? toggle() : playQueue(tracks, i));
            return (_jsxs("div", { role: "listitem", "aria-current": isNow, tabIndex: 0, className: 'row' + (dragFrom === i ? ' dragging' : '') + (dropAt === i && dragFrom !== null ? ' drop-line' : ''), draggable: !!onReorder, onDragStart: () => setDragFrom(i), onDragOver: (e) => { if (onReorder) {
                    e.preventDefault();
                    setDropAt(i);
                } }, onDrop: () => { if (onReorder && dragFrom !== null && dragFrom !== i)
                    onReorder(dragFrom, i); setDragFrom(null); setDropAt(null); }, onDragEnd: () => { setDragFrom(null); setDropAt(null); }, onDoubleClick: go, onKeyDown: (e) => e.key === 'Enter' && go(), onContextMenu: (e) => openTrackMenu(e, tr, playlistId), children: [_jsx("button", { className: "n tabular", "aria-label": `${t.play} ${tr.title}`, onClick: go, children: isNow ? _jsx(Eq, { paused: !playing }) : _jsxs(_Fragment, { children: [_jsx("span", { className: "num", children: i + 1 }), _jsx(Play, { className: "play-ico", size: 14, weight: "fill" })] }) }), _jsx("div", { className: "art", children: _jsx(Img, { src: tr.artwork, alt: "" }) }), _jsxs("div", { style: { minWidth: 0 }, children: [_jsxs("div", { className: "rt", children: [tr.source === 'ref' && _jsx("span", { className: "ref-dot", title: t.notMatched }), tr.title] }), _jsxs("div", { className: "ra", children: [_jsx("button", { className: "linkish", onClick: () => navigate({ name: 'artist', name_: primaryArtist(tr.artist) }), children: tr.artist }), why?.[tr.id] && _jsxs("span", { className: "faint", children: [" \u00B7 ", why[tr.id]] })] })] }), _jsxs("div", { className: "al row-gap", style: { flexWrap: 'nowrap', overflow: 'hidden' }, children: [showFeatures && f?.mood && _jsx("span", { className: "pill", children: t.moods[f.mood] ?? f.mood }), showFeatures && (f?.genre || tr.genre) && _jsx("span", { className: "pill", children: f?.genre ?? tr.genre }), showFeatures && f?.bpm ? _jsxs("span", { className: "pill tabular", children: [Math.round(f.bpm), " BPM"] }) : null, !showFeatures && tr.album] }), _jsx("button", { className: 'icon-btn sm' + (isLiked ? '' : ' hide'), "aria-pressed": isLiked, "aria-label": isLiked ? t.unlike : t.like, onClick: () => library.toggleLike(tr), children: _jsx(Heart, { size: 17, weight: isLiked ? 'fill' : 'regular', color: isLiked ? 'var(--accent)' : undefined }) }), _jsx("div", { className: "d tabular", children: tr.duration ? fmt(tr.duration) : '–' }), _jsx("button", { className: "icon-btn sm hide", "aria-label": t.more, onClick: (e) => openTrackMenu(e, tr, playlistId), children: _jsx(DotsThree, { size: 20, weight: "bold" }) })] }, tr.id + i));
        }) }));
}
