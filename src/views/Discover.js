import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ArrowsClockwise, MagnifyingGlass, Sparkle } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { TrackList } from '../components/TrackList';
import { Empty, SkeletonRows } from '../components/ui';
import { discover, similarTo } from '../lib/ai';
import { api, isTauri, ytmSearchUrl } from '../lib/api';
import { useT } from '../lib/i18n';
import { searchYt } from '../lib/tracks';
import { allTracks, useLibrary } from '../store/library';
import { useStatus } from '../store/status';
import { ErrorState, PlayActions } from './common';
import { useAsync } from './hooks';
const GENRES = ['Pop', 'Hip-hop', 'Indie', 'Electronic', 'R&B', 'Rock', 'Jazz', 'Lo-fi', 'Afrobeats', 'K-pop', 'Latin', 'Klassiskt'];
export function Discover({ q: initial = '' }) {
    const t = useT();
    const st = useStatus();
    const [q, setQ] = useState(initial);
    const [query, setQuery] = useState(initial);
    const [nonce, setNonce] = useState(0);
    const results = useAsync(() => searchYt(query, 20), [query], !!query && st.youtube);
    const disc = useAsync(async () => discover(await api.stats(30).catch(() => null)), [nonce], st.ai);
    const why = useMemo(() => Object.fromEntries((disc.data?.picks ?? []).map((p) => [p.id, p.why ?? ''])), [disc.data]);
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsx("h1", { className: "h-page", children: t.discover }) }), _jsxs("form", { className: "field", style: { height: 50, maxWidth: 620, marginBottom: 14 }, onSubmit: (e) => { e.preventDefault(); if (!st.youtube && isTauri && q.trim())
                    api.ytmOpen(ytmSearchUrl(q.trim()));
                else
                    setQuery(q.trim()); }, children: [_jsx(MagnifyingGlass, { size: 18, className: "faint" }), _jsx("input", { autoFocus: !!initial || undefined, value: q, onChange: (e) => setQ(e.target.value), placeholder: t.searchPlaceholder, "aria-label": t.search }), _jsx("span", { className: "faint", style: { fontSize: 12 }, children: st.youtube ? t.searchHint : t.ytmSearchHint })] }), _jsx("div", { className: "row-gap", style: { marginBottom: 24 }, children: GENRES.map((g) => _jsx("button", { className: "chip", "aria-pressed": query === `${g} hits`, onClick: () => { setQ(`${g} hits`); if (!st.youtube && isTauri)
                        api.ytmOpen(ytmSearchUrl(`${g} hits`));
                    else
                        setQuery(`${g} hits`); }, children: g }, g)) }), query && st.youtube && (_jsxs("section", { children: [_jsxs("h2", { className: "h-sec", style: { marginTop: 0 }, children: [t.search, ": \u201C", query, "\u201D"] }), results.loading ? _jsx(SkeletonRows, {}) : results.error ? _jsx(ErrorState, { error: results.error, retry: results.retry })
                        : !results.data?.length ? _jsx(Empty, { icon: _jsx(MagnifyingGlass, { size: 40, weight: "duotone" }), text: `${t.noResults} “${query}”` })
                            : _jsx(TrackList, { tracks: results.data, showFeatures: false })] })), _jsxs("section", { children: [_jsxs("h2", { className: "h-sec", children: [_jsxs("span", { children: [_jsx(Sparkle, { size: 18, weight: "fill", style: { color: 'var(--accent)', verticalAlign: -2 } }), " ", disc.data?.theme || t.discoverTitle] }), st.ai && _jsxs("button", { className: "btn", onClick: () => setNonce((n) => n + 1), disabled: disc.loading, children: [_jsx(ArrowsClockwise, { size: 15 }), t.refresh] })] }), !st.ai ? _jsx(ErrorState, { error: "ai:nokey" })
                        : disc.loading ? _jsx(SkeletonRows, { n: 6 }) : disc.error ? _jsx(ErrorState, { error: disc.error, retry: disc.retry })
                            : _jsxs(_Fragment, { children: [_jsx(PlayActions, { tracks: disc.data.picks }), _jsx(TrackList, { tracks: disc.data.picks, why: why })] })] }), disc.data && disc.data.rediscover.length > 0 && _jsxs("section", { children: [_jsx("h2", { className: "h-sec", children: t.rediscover }), _jsx(TrackList, { tracks: disc.data.rediscover })] })] }));
}
export function Similar({ id }) {
    const t = useT();
    const seed = useLibrary((s) => s.tracks[id]);
    const res = useAsync(() => similarTo(seed, 20), [id], !!seed);
    const why = useMemo(() => Object.fromEntries((res.data ?? []).map((p) => [p.id, p.why ?? ''])), [res.data]);
    if (!seed)
        return _jsx(Empty, { icon: _jsx(Sparkle, { size: 40 }), text: "\u2014" });
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: t.similar }), _jsx("h1", { className: "h-page", children: seed.title }), _jsx("p", { children: seed.artist })] }) }), res.loading ? _jsx(SkeletonRows, {}) : res.error ? _jsx(ErrorState, { error: res.error, retry: res.retry }) : _jsxs(_Fragment, { children: [_jsx(PlayActions, { tracks: [seed, ...res.data] }), _jsx(TrackList, { tracks: res.data, why: why })] })] }));
}
export const libraryCount = () => allTracks().length;
