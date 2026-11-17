import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MicrophoneStage } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { activeLine } from '../lib/lrc';
import { fetchLyrics } from '../lib/lyrics';
import { current, now, play, seek, usePlayer } from '../store/player';
import { useSettings } from '../store/settings';
import { Empty } from './ui';
export function Lyrics({ big }) {
    const t = useT();
    const index = usePlayer((s) => s.index);
    const track = current();
    const { lyricsOffset, wordSync } = useSettings();
    const [lyr, setLyr] = useState(undefined); // undefined = loading, null = none
    const box = useRef(null);
    const userScroll = useRef(0);
    useEffect(() => {
        if (!track)
            return;
        let live = true;
        setLyr(undefined);
        fetchLyrics(track).then((l) => live && setLyr(l), () => live && setLyr(null));
        return () => { live = false; };
    }, [track?.id, index]);
    // Frame loop drives highlight through the DOM directly — no React render per frame.
    useEffect(() => {
        if (!lyr?.synced || !box.current)
            return;
        const els = [...box.current.querySelectorAll('.ly')];
        let last = -2, raf = 0;
        const tick = () => {
            const tm = now() + lyricsOffset;
            const i = activeLine(lyr.lines, tm);
            if (i !== last) {
                els.forEach((el, j) => { el.classList.toggle('on', j === i); el.classList.toggle('past', j < i); });
                if (i >= 0 && performance.now() - userScroll.current > 3000)
                    els[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
                last = i;
            }
            if (i >= 0 && wordSync && lyr.lines[i].words.length) {
                const ws = els[i].querySelectorAll('.w');
                lyr.lines[i].words.forEach((w, k) => {
                    const p = Math.max(0, Math.min(1, (tm - w.time) / Math.max(0.05, w.end - w.time)));
                    ws[k].style.setProperty('--p', `${p * 100}%`);
                    ws[k].classList.toggle('done', p >= 1);
                });
            }
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(raf);
    }, [lyr, lyricsOffset, wordSync]);
    if (!track)
        return null;
    if (lyr === undefined)
        return _jsxs("div", { className: 'lyrics' + (big ? ' big' : ''), "aria-busy": "true", children: [_jsx("span", { className: "sr-only", children: t.loadingLyrics }), _jsxs("div", { className: "ly-dots", children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {})] })] });
    if (!lyr)
        return _jsx(Empty, { icon: _jsx(MicrophoneStage, { size: 40, weight: "duotone" }), text: t.noLyrics });
    return (_jsx("div", { ref: box, className: 'lyrics' + (big ? ' big' : '') + (lyr.synced ? '' : ' plain'), onWheel: () => (userScroll.current = performance.now()), "aria-label": t.lyrics, children: lyr.lines.map((l, i) => lyr.synced ? (_jsx("button", { className: "ly", onClick: () => { seek(l.time - lyricsOffset + 0.01); play(); }, children: wordSync && l.words.length ? l.words.map((w, k) => _jsx("span", { className: "w", children: w.text }, k)) : l.text || '♪' }, i)) : _jsx("p", { className: "ly plain", children: l.text || ' ' }, i)) }));
}
