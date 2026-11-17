import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowsOutSimple, Heart, Moon, Pause, PictureInPicture, Play, Queue, Repeat, RepeatOnce, Shuffle, SkipBack, SkipForward, SpeakerHigh, SpeakerLow, SpeakerX, Spinner, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { api, errText, isTauri } from '../lib/api';
import { useT } from '../lib/i18n';
import { primaryArtist } from '../lib/tracks';
import { useMini } from '../store/bridge';
import { library, useLibrary } from '../store/library';
import { current, cycleRepeat, next, prev, seek, setSleep, setVolume, toggle, toggleMute, toggleShuffle, usePlayer, useTime } from '../store/player';
import { navigate, useRouter } from '../store/router';
import { useSettings } from '../store/settings';
import { openTrackMenu } from './TrackMenu';
import { fmt, Img, Slider } from './ui';
export function Progress() {
    const { position, duration, buffered } = useTime();
    return (_jsxs("div", { className: "progress tabular", children: [_jsx("span", { children: fmt(position) }), _jsx(Slider, { label: "Seek", value: position, max: duration || 1, buffered: buffered, onCommit: seek }), _jsx("span", { children: fmt(duration) })] }));
}
export function Transport({ compact }) {
    const t = useT();
    const { playing, loading, shuffle, repeat, error } = usePlayer();
    const sv = useSettings((s) => s.lang) === 'sv';
    return (_jsxs("div", { className: "btns", children: [!compact && _jsx("button", { className: "icon-btn sm", "aria-pressed": shuffle, "aria-label": t.shuffle, title: t.smartShuffle, onClick: toggleShuffle, children: _jsx(Shuffle, { size: 18, weight: "bold" }) }), _jsx("button", { className: "icon-btn", "aria-label": t.prev, onClick: prev, children: _jsx(SkipBack, { size: 22, weight: "fill" }) }), _jsx("button", { className: "play", "aria-label": playing ? t.pause : t.play, onClick: toggle, title: error ? errText(error, sv) : undefined, children: error ? _jsx(WarningCircle, { size: 22, weight: "fill" }) : playing ? _jsx(Pause, { size: 20, weight: "fill" }) : loading ? _jsx(Spinner, { size: 20, className: "spin" }) : _jsx(Play, { size: 20, weight: "fill", style: { marginLeft: 2 } }) }), _jsx("button", { className: "icon-btn", "aria-label": t.next, onClick: () => next(), children: _jsx(SkipForward, { size: 22, weight: "fill" }) }), !compact && _jsx("button", { className: "icon-btn sm", "aria-pressed": repeat !== 'off', "aria-label": `${t.repeat}: ${repeat}`, onClick: cycleRepeat, children: repeat === 'one' ? _jsx(RepeatOnce, { size: 18, weight: "bold" }) : _jsx(Repeat, { size: 18, weight: "bold" }) })] }));
}
export function Volume() {
    const t = useT();
    const volume = useSettings((s) => s.volume);
    const muted = usePlayer((s) => s.muted);
    const v = muted ? 0 : volume;
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "icon-btn sm", "aria-label": t.mute, "aria-pressed": muted, onClick: toggleMute, children: v === 0 ? _jsx(SpeakerX, { size: 18 }) : v < 0.5 ? _jsx(SpeakerLow, { size: 18 }) : _jsx(SpeakerHigh, { size: 18 }) }), _jsx(Slider, { label: t.volume, value: v, max: 1, onChange: setVolume, onCommit: setVolume })] }));
}
function SleepButton() {
    const t = useT();
    const sleepAt = usePlayer((s) => s.sleepAt);
    const [open, setOpen] = useState(false);
    const left = sleepAt > 0 ? Math.ceil((sleepAt - Date.now()) / 60000) : 0;
    return (_jsxs("div", { style: { position: 'relative' }, children: [_jsx("button", { className: "icon-btn sm", "aria-pressed": sleepAt !== 0, "aria-label": t.sleepTimer, title: sleepAt > 0 ? `${left} min` : t.sleepTimer, onClick: () => setOpen(!open), children: _jsx(Moon, { size: 18 }) }), open && (_jsxs("div", { className: "menu glass", role: "menu", style: { position: 'absolute', bottom: 48, right: 0, left: 'auto', top: 'auto' }, onMouseLeave: () => setOpen(false), children: [_jsx("div", { className: "sub-label", children: t.sleepTimer }), [[0, t.sleepOff], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 h'], [-1, t.sleepEnd]].map(([m, l]) => (_jsx("button", { role: "menuitem", onClick: () => { setSleep(m); setOpen(false); }, children: l }, m)))] }))] }));
}
export function PlayerBar() {
    const t = useT();
    usePlayer((s) => s.index);
    const liked = useLibrary((s) => s.liked);
    const miniOpen = useMini((s) => s.open);
    const onNow = useRouter((s) => s.stack[s.pos].name === 'now');
    const tr = current();
    const isLiked = !!tr && liked.includes(tr.id);
    return (_jsxs("footer", { className: "bar glass", "aria-label": "Player", children: [_jsx("div", { className: "np", children: tr ? _jsxs(_Fragment, { children: [_jsx("button", { className: "art", "aria-label": t.now, onClick: () => navigate({ name: 'now' }), children: _jsx(Img, { src: tr.artwork, alt: tr.title }) }), _jsxs("div", { className: "txt", onContextMenu: (e) => openTrackMenu(e, tr), children: [_jsx("div", { className: "tt", children: tr.title }), _jsx("div", { className: "ta", children: _jsx("button", { className: "linkish", onClick: () => navigate({ name: 'artist', name_: primaryArtist(tr.artist) }), children: tr.artist }) })] }), _jsx("button", { className: "icon-btn sm", "aria-pressed": isLiked, "aria-label": isLiked ? t.unlike : t.like, onClick: () => library.toggleLike(tr), children: _jsx(Heart, { size: 18, weight: isLiked ? 'fill' : 'regular' }) })] }) : _jsx("span", { className: "faint", children: t.nothingPlaying }) }), _jsxs("div", { className: "transport", children: [_jsx(Transport, {}), _jsx(Progress, {})] }), _jsxs("div", { className: "tools", children: [_jsx(SleepButton, {}), _jsx("button", { className: "icon-btn sm", "aria-pressed": onNow, "aria-label": t.queue, onClick: () => navigate({ name: 'now' }), children: _jsx(Queue, { size: 18 }) }), isTauri && _jsx("button", { className: "icon-btn sm", "aria-pressed": miniOpen, "aria-label": t.miniPlayer, onClick: () => api.miniToggle(), children: _jsx(PictureInPicture, { size: 18 }) }), _jsx(Volume, {}), _jsx("button", { className: "icon-btn sm", "aria-label": t.now, onClick: () => navigate({ name: 'now' }), disabled: !tr, children: _jsx(ArrowsOutSimple, { size: 18 }) })] })] }));
}
