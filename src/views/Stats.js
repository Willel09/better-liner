import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ChartBar, Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Empty, SkeletonRows } from '../components/ui';
import { dnaFrom, dnaProfile } from '../lib/ai';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { useLibrary } from '../store/library';
import { useStatus } from '../store/status';
import { ErrorState } from './common';
import { useAsync } from './hooks';
function TopList({ items, unit, label }) {
    const max = Math.max(1, ...items.map((x) => x.plays));
    return (_jsx("div", { children: items.slice(0, 8).map((x, i) => (_jsxs("div", { className: "hbar", children: [_jsx("span", { className: "faint tabular", children: i + 1 }), _jsxs("div", { className: "lbl", children: [label ? label(x.key) : x.key, x.sub && _jsx("small", { children: x.sub })] }), _jsxs("span", { className: "faint tabular", style: { fontSize: 12 }, children: [x.plays, " ", unit] }), _jsx("div", { className: "meter", children: _jsx("i", { style: { width: `${(x.plays / max) * 100}%` } }) })] }, x.key + i))) }));
}
/** Single-series bar chart with hover tooltips; one accent hue, no legend needed. */
function Bars({ values, labels, tip }) {
    const max = Math.max(1, ...values);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "bars", role: "img", "aria-label": values.map((v, i) => tip(i)).join(', '), children: values.map((v, i) => _jsx("div", { className: "b", "data-tip": tip(i), children: _jsx("i", { style: { height: `${(v / max) * 100}%` } }) }, i)) }), _jsxs("div", { className: "axis", children: [_jsx("span", { children: labels[0] }), _jsx("span", { children: labels[1] }), _jsx("span", { children: labels[2] })] })] }));
}
function Radar({ dna }) {
    const t = useT();
    const n = dna.axes.length, R = 110, cx = 150, cy = 140;
    const pt = (i, r) => [cx + r * Math.sin((i / n) * 2 * Math.PI), cy - r * Math.cos((i / n) * 2 * Math.PI)];
    const poly = dna.axes.map((a, i) => pt(i, R * Math.max(0.04, a.value)).join(',')).join(' ');
    return (_jsxs("svg", { className: "radar", viewBox: "0 0 300 285", width: "100%", style: { maxWidth: 340 }, role: "img", "aria-label": dna.axes.map((a) => `${a.key} ${Math.round(a.value * 100)}%`).join(', '), children: [[0.25, 0.5, 0.75, 1].map((k) => _jsx("polygon", { points: dna.axes.map((_, i) => pt(i, R * k).join(',')).join(' '), fill: "none", stroke: "var(--hair)" }, k)), dna.axes.map((_, i) => { const [x, y] = pt(i, R); return _jsx("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "var(--hair)" }, i); }), _jsx("polygon", { points: poly, fill: "color-mix(in srgb, var(--accent) 30%, transparent)", stroke: "var(--accent)", strokeWidth: 2, strokeLinejoin: "round" }), dna.axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(0.04, a.value)); return _jsx("circle", { cx: x, cy: y, r: 4, fill: "var(--accent)", stroke: "var(--base)", strokeWidth: 2, children: _jsx("title", { children: `${t.axes[a.key]}: ${Math.round(a.value * 100)}%` }) }, i); }), dna.axes.map((a, i) => { const [x, y] = pt(i, R + 18); return _jsx("text", { x: x, y: y, textAnchor: "middle", dominantBaseline: "middle", children: t.axes[a.key] }, i); })] }));
}
export function Stats() {
    const t = useT();
    const st = useStatus();
    const [days, setDays] = useState(30);
    const s = useAsync(() => api.stats(days), [days]);
    useLibrary((x) => x.plays);
    const dna = dnaFrom(s.data ?? null);
    const [profile, setProfile] = useState(null);
    const [busy, setBusy] = useState(false);
    const today = Math.floor((Date.now() / 1000 - new Date().getTimezoneOffset() * 60) / 86400);
    const span = days > 0 ? Math.min(days, 60) : 60;
    const perDay = Array.from({ length: span }, (_, i) => s.data?.by_day.find((d) => d[0] === today - span + 1 + i)?.[1] ?? 0);
    const dayLabel = (i) => new Date((today - span + 1 + i) * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { className: "page-head", children: [_jsx("h1", { className: "h-page", children: t.stats }), _jsx("div", { className: "seg wide", children: [[7, t.range7], [30, t.range30], [365, t.range365], [0, t.rangeAll]].map(([d, l]) => _jsx("button", { "aria-pressed": days === d, onClick: () => setDays(d), children: l }, d)) })] }), s.loading && !s.data ? _jsx(SkeletonRows, {}) : s.error ? _jsx(ErrorState, { error: s.error, retry: s.retry }) : !s.data?.plays ? _jsx(Empty, { icon: _jsx(ChartBar, { size: 40, weight: "duotone" }), text: t.noStats }) : (_jsxs("div", { className: "bento", children: [[[t.listeningTime, Math.round(s.data.minutes), t.minutes], [t.tracksPlayed, s.data.tracks, ''], [t.artistsPlayed, s.data.artists, ''], [t.plays, s.data.plays, '']].map(([l, v, u]) => (_jsxs("section", { className: "tile glass span-4", style: { gridColumn: 'span 3', minHeight: 110 }, children: [_jsx("div", { className: "eyebrow", children: l }), _jsxs("div", { className: "kpi", children: [v.toLocaleString(), _jsx("small", { children: u })] })] }, l))), _jsxs("section", { className: "tile glass span-8", children: [_jsx("b", { children: t.perDay }), _jsx(Bars, { values: perDay, labels: [dayLabel(0), dayLabel(Math.floor(span / 2)), dayLabel(span - 1)], tip: (i) => `${dayLabel(i)}: ${Math.round(perDay[i])} min` })] }), _jsxs("section", { className: "tile glass span-4", children: [_jsx("b", { children: t.perHour }), _jsx(Bars, { values: s.data.by_hour, labels: ['00', '12', '23'], tip: (i) => `${String(i).padStart(2, '0')}:00 — ${Math.round(s.data.by_hour[i])} min` })] }), _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topTracks }), _jsx(TopList, { items: s.data.top_tracks, unit: "\u00D7" })] }), _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topArtists }), _jsx(TopList, { items: s.data.top_artists, unit: "\u00D7" })] }), s.data.top_genres.length > 0 && _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topGenres }), _jsx(TopList, { items: s.data.top_genres, unit: "\u00D7" })] }), s.data.top_moods.length > 0 && _jsxs("section", { className: "tile glass span-6", children: [_jsx("b", { children: t.topMoods }), _jsx(TopList, { items: s.data.top_moods, unit: "\u00D7", label: (k) => t.moods[k] ?? k })] }), _jsxs("section", { className: "tile glass span-12", style: { flexDirection: 'row', gap: 28, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(Radar, { dna: dna }), _jsxs("div", { style: { flex: 1, minWidth: 260 }, children: [_jsx("div", { className: "eyebrow", children: t.dna }), _jsx("h2", { className: "h-hero", style: { fontSize: 32, margin: '6px 0' }, children: profile?.title ?? t.dna }), _jsx("p", { className: "muted", style: { maxWidth: '60ch', lineHeight: 1.6 }, children: profile?.summary ?? t.dnaHint }), _jsx("div", { className: "row-gap", style: { margin: '10px 0 14px' }, children: dna.genres.map((g) => _jsxs("span", { className: "pill", children: [g.key, " ", Math.round(g.share * 100), "%"] }, g.key)) }), st.ai && _jsxs("button", { className: "btn primary", disabled: busy, onClick: async () => { setBusy(true); try {
                                            setProfile(await dnaProfile(dna));
                                        }
                                        catch { /* shown as unchanged */ } setBusy(false); }, children: [_jsx(Sparkle, { size: 16, weight: "fill" }), t.describeMe] })] })] })] }))] }));
}
