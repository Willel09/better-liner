import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MusicNotesSimple, Play } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { create } from '../store/create';
export const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0)
        s = 0;
    const m = Math.floor(s / 60), x = Math.floor(s % 60);
    return `${m}:${x.toString().padStart(2, '0')}`;
};
export function Img({ src, alt, round }) {
    const [bad, setBad] = useState(false);
    useEffect(() => setBad(false), [src]);
    return src && !bad
        ? _jsx("img", { src: src, alt: alt, loading: "lazy", draggable: false, onError: () => setBad(true), style: round ? { borderRadius: '50%' } : undefined })
        : _jsx("div", { className: "cover-fallback", role: "img", "aria-label": alt, children: _jsx(MusicNotesSimple, { size: 28, weight: "duotone" }) });
}
export function Card({ title, sub, art, round, onOpen, onPlay, onContext }) {
    return (_jsxs("div", { className: "card", role: "button", tabIndex: 0, onClick: onOpen, onContextMenu: onContext, onKeyDown: (e) => e.key === 'Enter' && onOpen(), children: [_jsxs("div", { className: 'cover' + (round ? ' round' : ''), children: [_jsx(Img, { src: art, alt: "" }), onPlay && (_jsx("button", { className: "play-fab fab", "aria-label": `Play ${title}`, onClick: (e) => { e.stopPropagation(); onPlay(); }, children: _jsx(Play, { size: 18, weight: "fill" }) }))] }), _jsxs("div", { style: round ? { textAlign: 'center' } : undefined, children: [_jsx("div", { className: "t", children: title }), sub && _jsx("div", { className: "s", children: sub })] })] }));
}
export function Slider({ value, max, buffered = 0, onChange, onCommit, label }) {
    const ref = useRef(null);
    const [drag, setDrag] = useState(null);
    const v = drag ?? value;
    const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
    const at = (x) => { const r = ref.current.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * max; };
    return (_jsxs("div", { ref: ref, className: 'slider' + (drag !== null ? ' drag' : ''), role: "slider", tabIndex: 0, "aria-label": label, "aria-valuemin": 0, "aria-valuemax": Math.round(max), "aria-valuenow": Math.round(v), onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); const x = at(e.clientX); setDrag(x); onChange?.(x); }, onPointerMove: (e) => { if (drag !== null) {
            const x = at(e.clientX);
            setDrag(x);
            onChange?.(x);
        } }, onPointerUp: (e) => { if (drag !== null) {
            onCommit(at(e.clientX));
            setDrag(null);
        } }, onKeyDown: (e) => {
            const step = max / 20;
            if (e.key === 'ArrowRight') {
                e.stopPropagation();
                onCommit(Math.min(max, value + step));
            }
            if (e.key === 'ArrowLeft') {
                e.stopPropagation();
                onCommit(Math.max(0, value - step));
            }
        }, children: [_jsxs("div", { className: "track", children: [_jsx("div", { className: "buf", style: { width: `${max ? Math.min(100, (buffered / max) * 100) : 0}%` } }), _jsx("div", { className: "fill", style: { width: `${pct}%` } })] }), _jsx("div", { className: "knob", style: { left: `${pct}%` } })] }));
}
export function Empty({ icon, text, children }) {
    return _jsxs("div", { className: "empty", children: [icon, _jsx("p", { style: { maxWidth: '40ch', margin: 0 }, children: text }), children] });
}
export function SkeletonGrid({ n = 6 }) {
    return _jsx("div", { className: "grid", children: Array.from({ length: n }, (_, i) => _jsxs("div", { children: [_jsx("div", { className: "skel", style: { aspectRatio: '1' } }), _jsx("div", { className: "skel", style: { height: 12, marginTop: 10, width: '70%' } })] }, i)) });
}
export function SkeletonRows({ n = 8 }) {
    return _jsx("div", { className: "rows", children: Array.from({ length: n }, (_, i) => _jsx("div", { className: "skel", style: { height: 48, margin: '6px 0' } }, i)) });
}
// ---------- toast ----------
export const useToast = create({ msg: '' });
let toastTimer = 0;
export function toast(msg) {
    useToast.set({ msg });
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => useToast.set({ msg: '' }), 2200);
}
export function Toast() {
    const msg = useToast((s) => s.msg);
    return msg ? _jsx("div", { className: "toast glass strong", role: "status", children: msg }) : null;
}
const usePrompt = create({ req: null });
export const prompt = (title, value, ok, cancel) => new Promise((resolve) => usePrompt.set({ req: { title, value, ok, cancel, resolve } }));
export function PromptHost() {
    const req = usePrompt((s) => s.req);
    const [v, setV] = useState('');
    useEffect(() => setV(req?.value ?? ''), [req]);
    if (!req)
        return null;
    const done = (out) => { req.resolve(out); usePrompt.set({ req: null }); };
    return (_jsx("div", { className: "scrim", onMouseDown: (e) => e.target === e.currentTarget && done(null), children: _jsxs("form", { className: "dialog glass", role: "dialog", "aria-label": req.title, onSubmit: (e) => { e.preventDefault(); if (v.trim())
                done(v.trim()); }, children: [_jsx("h2", { style: { fontSize: 17 }, children: req.title }), _jsx("label", { className: "field", children: _jsx("input", { autoFocus: true, value: v, onChange: (e) => setV(e.target.value), "aria-label": req.title, maxLength: 100 }) }), _jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 }, children: [_jsx("button", { type: "button", className: "btn", onClick: () => done(null), children: req.cancel }), _jsx("button", { type: "submit", className: "btn primary", disabled: !v.trim(), children: req.ok })] })] }) }));
}
