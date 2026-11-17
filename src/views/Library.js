import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Disc, FolderPlus, Heart, MagicWand, MicrophoneStage, MusicNotesPlus, PencilSimple, Plus, Trash, UploadSimple, UserPlus, Check, X } from '@phosphor-icons/react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useMemo, useState } from 'react';
import { TrackList } from '../components/TrackList';
import { Card, Empty, Img, prompt, SkeletonRows, toast } from '../components/ui';
import { analyzeTracks } from '../lib/ai';
import { api, errText, isTauri } from '../lib/api';
import { useT } from '../lib/i18n';
import { parseTrackList } from '../lib/match';
import { localToTrack, primaryArtist, searchYt } from '../lib/tracks';
import { allTracks, library, refTrack, resolve, smartTracks, useLibrary } from '../store/library';
import { playQueue } from '../store/player';
import { back, navigate } from '../store/router';
import { useSettings } from '../store/settings';
import { useStatus } from '../store/status';
import { CollectionHeader, ErrorState, PlayActions, totalMin } from './common';
import { useAsync } from './hooks';
function useAll() {
    const s = useLibrary();
    return useMemo(() => allTracks(), [s.tracks, s.saved, s.liked, s.local, s.playlists]);
}
export async function addLocalFolder(sv) {
    if (!isTauri)
        return toast(errText('desktop-only', sv));
    const picked = await openDialog({ directory: true, multiple: true });
    if (!picked)
        return;
    try {
        const ts = (await api.localScan(Array.isArray(picked) ? picked : [picked])).map(localToTrack);
        library.addLocal(ts);
        toast(`${ts.length} ${sv ? 'låtar' : 'songs'}`);
        analyzeTracks(ts).catch(() => { }); // BPM + loudness from the audio; AI mood/genre if a key is set
    }
    catch (e) {
        toast(errText(e, sv));
    }
}
// ---------------- Library ----------------
export function LibraryView() {
    const t = useT();
    const sv = useSettings((s) => s.lang) === 'sv';
    const all = useAll();
    const { features, plays, saved } = useLibrary();
    const [sort, setSort] = useState('added');
    const [mood, setMood] = useState('');
    const [text, setText] = useState('');
    const moods = useMemo(() => [...new Set(all.map((x) => features[x.id]?.mood).filter(Boolean))], [all, features]);
    const list = useMemo(() => {
        let l = all.filter((x) => (!mood || features[x.id]?.mood === mood) && (!text || (x.title + ' ' + x.artist + ' ' + (x.album ?? '')).toLowerCase().includes(text.toLowerCase())));
        const by = { title: (a, b) => a.title.localeCompare(b.title), artist: (a, b) => a.artist.localeCompare(b.artist),
            plays: (a, b) => (plays[b.id] ?? 0) - (plays[a.id] ?? 0), bpm: (a, b) => (features[a.id]?.bpm ?? 999) - (features[b.id]?.bpm ?? 999),
            added: (a, b) => { const ia = saved.indexOf(a.id), ib = saved.indexOf(b.id); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); } };
        return [...l].sort(by[sort]);
    }, [all, sort, mood, text, features, plays, saved]);
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { className: "page-head", children: [_jsxs("div", { children: [_jsx("h1", { className: "h-page", children: t.library }), _jsxs("p", { children: [all.length, " ", t.songs, " \u00B7 ", totalMin(all), " min"] })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("button", { className: "btn glassy", onClick: () => addLocalFolder(sv), children: [_jsx(FolderPlus, { size: 16 }), t.addLocal] }), _jsxs("button", { className: "btn glassy", onClick: () => navigate({ name: 'playlists' }), children: [_jsx(UploadSimple, { size: 16 }), t.importPlaylist] })] })] }), !all.length ? _jsx(Empty, { icon: _jsx(MusicNotesPlus, { size: 40, weight: "duotone" }), text: t.libraryEmpty, children: _jsx("button", { className: "btn primary", onClick: () => navigate({ name: 'discover' }), children: t.discover }) }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: "toolbar", style: { marginBottom: 14 }, children: [_jsx("label", { className: "field", style: { width: 240, height: 36 }, children: _jsx("input", { value: text, onChange: (e) => setText(e.target.value), placeholder: t.filter, "aria-label": t.filter }) }), _jsx("div", { className: "seg wide", children: ['added', 'title', 'artist', 'plays', 'bpm'].map((k) => _jsx("button", { "aria-pressed": sort === k, onClick: () => setSort(k), children: { added: t.recentlyAdded, title: t.title, artist: t.artist, plays: t.plays, bpm: 'BPM' }[k] }, k)) }), moods.length > 0 && _jsx("div", { className: "row-gap", children: moods.map((m) => _jsx("button", { className: "chip", "aria-pressed": mood === m, onClick: () => setMood(mood === m ? '' : m), children: t.moods[m] ?? m }, m)) })] }), _jsx(PlayActions, { tracks: list }), _jsx(TrackList, { tracks: list })] })] }));
}
export function Liked() {
    const t = useT();
    const ids = useLibrary((s) => s.liked), all = useLibrary((s) => s.tracks);
    const tracks = useMemo(() => ids.map((x) => all[x]).filter(Boolean), [ids, all]);
    return (_jsxs("div", { className: "page", children: [_jsx(CollectionHeader, { kind: t.playlists, title: t.liked, sub: `${tracks.length} ${t.songs}`, art: _jsx("div", { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 25%, #140d24))' }, children: _jsx(Heart, { size: 84, weight: "fill", color: "#fff" }) }) }), _jsx(PlayActions, { tracks: tracks }), tracks.length ? _jsx(TrackList, { tracks: tracks }) : _jsx(Empty, { icon: _jsx(Heart, { size: 40, weight: "duotone" }), text: t.emptyLiked })] }));
}
// ---------------- Playlists (+ import, smart playlists) ----------------
function ImportBox({ onDone }) {
    const t = useT();
    const sv = useSettings((s) => s.lang) === 'sv';
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const run = async () => {
        const v = text.trim();
        if (!v)
            return;
        setBusy(true);
        try {
            let name, items;
            if (/^https?:\/\/|^spotify:/.test(v) && !v.includes('\n')) {
                const r = await api.importPlaylist(v);
                name = r.name;
                items = r.tracks;
            }
            else {
                name = (await prompt(t.importPlaylist, sv ? 'Importerad spellista' : 'Imported playlist', t.save, t.cancel)) ?? '';
                if (!name)
                    return;
                items = parseTrackList(v);
            }
            // Imported songs are references (title + artist). They're matched to YouTube when played — no quota spent up front.
            const tracks = items.filter((x) => x.title).map((x) => refTrack(x.title, x.artist, { album: x.album || undefined, duration: x.duration ?? 0 }));
            const pl = library.createPlaylist(name, [], {});
            library.addToPlaylist(pl.id, tracks);
            library.save(tracks);
            toast(`${t.imported}: ${tracks.length} ${t.songs}`);
            setText('');
            onDone();
            navigate({ name: 'playlist', id: pl.id });
        }
        catch (e) {
            toast(errText(e, sv));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "tile glass", style: { marginBottom: 24 }, children: [_jsx("b", { children: t.importPlaylist }), _jsx("p", { className: "muted", style: { margin: 0, fontSize: 12.5 }, children: t.importHint }), _jsx("textarea", { className: "field", style: { height: 96, borderRadius: 16, padding: 12, resize: 'vertical', border: 0, outline: 'none' }, value: text, onChange: (e) => setText(e.target.value), placeholder: 'https://open.spotify.com/playlist/…\nhttps://www.deezer.com/playlist/…\nArtist - Title', "aria-label": t.importPlaylist }), _jsx("div", { className: "row-gap", children: _jsxs("button", { className: "btn primary", disabled: busy || !text.trim(), onClick: run, children: [_jsx(UploadSimple, { size: 16 }), busy ? t.importing : t.importPlaylist] }) })] }));
}
export function Playlists() {
    const t = useT();
    const { playlists, tracks, liked } = useLibrary();
    const [importing, setImporting] = useState(false);
    const folders = [...new Set(playlists.map((p) => p.folder ?? ''))].sort();
    return (_jsxs("div", { className: "page", children: [_jsxs("div", { className: "page-head", children: [_jsx("h1", { className: "h-page", children: t.playlists }), _jsxs("div", { className: "toolbar", children: [_jsxs("button", { className: "btn glassy", onClick: () => setImporting(!importing), children: [_jsx(UploadSimple, { size: 16 }), t.importPlaylist] }), _jsxs("button", { className: "btn glassy", onClick: async () => { const n = await prompt(t.smartPlaylist, t.smartPlaylist, t.create, t.cancel); if (n)
                                    navigate({ name: 'playlist', id: library.createPlaylist(n, [], { smart: [{ field: 'mood', op: 'is', value: 'chill' }] }).id }); }, children: [_jsx(MagicWand, { size: 16 }), t.smartPlaylist] }), _jsxs("button", { className: "btn primary", onClick: async () => { const n = await prompt(t.newPlaylist, '', t.create, t.cancel); if (n)
                                    navigate({ name: 'playlist', id: library.createPlaylist(n).id }); }, children: [_jsx(Plus, { size: 16, weight: "bold" }), t.newPlaylist] })] })] }), importing && _jsx(ImportBox, { onDone: () => setImporting(false) }), folders.map((f) => (_jsxs("section", { children: [f && _jsx("h2", { className: "h-sec", children: f }), _jsxs("div", { className: "grid", children: [!f && _jsx(Card, { title: t.liked, sub: `${liked.length} ${t.songs}`, art: tracks[liked[0]]?.artwork ?? null, onOpen: () => navigate({ name: 'liked' }), onPlay: () => playQueue(resolve(liked)) }), playlists.filter((p) => (p.folder ?? '') === f).map((p) => (_jsx(Card, { title: p.name, sub: p.smart ? t.smartPlaylist : p.ai ? `AI · ${p.trackIds.length} ${t.songs}` : `${p.trackIds.length} ${t.songs}`, art: tracks[p.trackIds[0]]?.artwork ?? null, onOpen: () => navigate({ name: 'playlist', id: p.id }), onPlay: () => playQueue(p.smart ? smartTracks(p.smart) : resolve(p.trackIds)) }, p.id)))] })] }, f || '_')))] }));
}
function RuleEditor({ rules, onChange }) {
    const t = useT();
    const fields = ['mood', 'genre', 'bpm', 'energy', 'artist', 'liked', 'plays'];
    return (_jsxs("div", { className: "tile glass", style: { marginBottom: 18, minHeight: 0 }, children: [_jsx("b", { children: t.rules }), rules.map((r, i) => (_jsxs("div", { className: "row-gap", children: [_jsx("select", { className: "chip", value: r.field, onChange: (e) => onChange(rules.map((x, j) => (j === i ? { ...x, field: e.target.value } : x))), "aria-label": "field", children: fields.map((f) => _jsx("option", { children: f }, f)) }), _jsx("select", { className: "chip", value: r.op, onChange: (e) => onChange(rules.map((x, j) => (j === i ? { ...x, op: e.target.value } : x))), "aria-label": "operator", children: ['is', 'contains', 'gt', 'lt'].map((o) => _jsx("option", { value: o, children: { is: '=', contains: '∋', gt: '>', lt: '<' }[o] }, o)) }), _jsx("label", { className: "field", style: { height: 32, width: 180 }, children: _jsx("input", { value: r.value, onChange: (e) => onChange(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))), "aria-label": "value" }) }), _jsx("button", { className: "icon-btn sm", "aria-label": t.remove, onClick: () => onChange(rules.filter((_, j) => j !== i)), children: _jsx(X, { size: 15 }) })] }, i))), _jsx("div", { children: _jsxs("button", { className: "btn", onClick: () => onChange([...rules, { field: 'genre', op: 'contains', value: '' }]), children: [_jsx(Plus, { size: 14 }), t.addRule] }) })] }));
}
export function PlaylistView({ id }) {
    const t = useT();
    const pl = useLibrary((s) => s.playlists.find((p) => p.id === id));
    const s = useLibrary();
    const tracks = useMemo(() => (pl ? (pl.smart ? smartTracks(pl.smart) : pl.trackIds.map((x) => s.tracks[x]).filter(Boolean)) : []), [pl, s.tracks, s.features, s.plays, s.liked]);
    if (!pl)
        return _jsx(Empty, { icon: _jsx(MusicNotesPlus, { size: 40 }), text: "\u2014" });
    return (_jsxs("div", { className: "page", children: [_jsx(CollectionHeader, { title: pl.name, art: tracks[0]?.artwork ?? null, kind: pl.smart ? t.smartPlaylist : pl.ai ? 'AI' : t.playlists, sub: `${tracks.length} ${t.songs} · ${totalMin(tracks)} min`, children: pl.ai && _jsxs("div", { className: "faint", style: { fontSize: 12.5 }, children: ["\u201C", pl.ai, "\u201D"] }) }), _jsxs(PlayActions, { tracks: tracks, children: [_jsx("button", { className: "icon-btn", "aria-label": t.rename, onClick: async () => { const n = await prompt(t.rename, pl.name, t.save, t.cancel); if (n)
                            library.updatePlaylist(pl.id, { name: n }); }, children: _jsx(PencilSimple, { size: 20 }) }), _jsx("button", { className: "icon-btn", "aria-label": t.analyze, onClick: () => analyzeTracks(tracks).then(() => toast(t.analyzed), (e) => toast(errText(e, useSettings.get().lang === 'sv'))), children: _jsx(MagicWand, { size: 20 }) }), _jsx("button", { className: "icon-btn", "aria-label": t.delete, onClick: () => { library.deletePlaylist(pl.id); back(); }, children: _jsx(Trash, { size: 20 }) })] }), pl.smart && _jsx(RuleEditor, { rules: pl.smart, onChange: (smart) => library.updatePlaylist(pl.id, { smart }) }), tracks.length ? _jsx(TrackList, { tracks: tracks, playlistId: pl.smart ? undefined : pl.id, onReorder: pl.smart ? undefined : (a, b) => library.moveInPlaylist(pl.id, a, b) })
                : _jsx(Empty, { icon: _jsx(MusicNotesPlus, { size: 40, weight: "duotone" }), text: t.emptyPlaylist })] }));
}
// ---------------- Artists ----------------
export function Artists() {
    const t = useT();
    const all = useAll();
    const followed = useLibrary((s) => s.followed);
    const artists = useMemo(() => {
        const m = new Map();
        all.forEach((x) => { const a = primaryArtist(x.artist); m.set(a, [...(m.get(a) ?? []), x]); });
        return [...m].sort((a, b) => Number(followed.includes(b[0])) - Number(followed.includes(a[0])) || b[1].length - a[1].length);
    }, [all, followed]);
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsx("h1", { className: "h-page", children: t.artists }) }), !artists.length ? _jsx(Empty, { icon: _jsx(MicrophoneStage, { size: 40, weight: "duotone" }), text: t.noArtists }) : (_jsx("div", { className: "grid", children: artists.map(([name, ts]) => (_jsx(Card, { round: true, title: name, sub: `${ts.length} ${t.songs}${followed.includes(name) ? ' · ' + t.following : ''}`, art: ts.find((x) => x.artwork)?.artwork ?? null, onOpen: () => navigate({ name: 'artist', name_: name }), onPlay: () => playQueue(ts) }, name))) }))] }));
}
export function ArtistView({ name }) {
    const t = useT();
    const all = useAll();
    const st = useStatus();
    const followed = useLibrary((s) => s.followed).includes(name);
    const mine = useMemo(() => all.filter((x) => primaryArtist(x.artist).toLowerCase() === name.toLowerCase()), [all, name]);
    const yt = useAsync(() => searchYt(`${name} songs`, 20), [name], st.youtube);
    const popular = useMemo(() => (yt.data ?? []).filter((x) => x.artist.toLowerCase().includes(name.toLowerCase()) || x.title.toLowerCase().includes(name.toLowerCase())), [yt.data, name]);
    const art = mine.find((x) => x.artwork)?.artwork ?? popular[0]?.artwork ?? null;
    return (_jsxs("div", { className: "page", children: [_jsxs("header", { className: "artist-hero", children: [art && _jsx("img", { className: "bg", src: art, alt: "", style: { filter: 'blur(30px) saturate(140%)', transform: 'scale(1.2)' } }), _jsxs("div", { className: "meta", children: [_jsx("div", { className: "avatar", children: _jsx(Img, { src: art, alt: name }) }), _jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: t.artist }), _jsx("h1", { className: "h-hero", children: name })] })] })] }), _jsx(PlayActions, { tracks: [...mine, ...popular], children: _jsxs("button", { className: "btn glassy", "aria-pressed": followed, onClick: () => library.follow(name), children: [followed ? _jsx(Check, { size: 16, weight: "bold" }) : _jsx(UserPlus, { size: 16 }), followed ? t.following : t.follow] }) }), mine.length > 0 && _jsxs(_Fragment, { children: [_jsx("h2", { className: "h-sec", children: t.inLibrary }), _jsx(TrackList, { tracks: mine })] }), st.youtube && _jsxs(_Fragment, { children: [_jsx("h2", { className: "h-sec", children: t.popularOnYt }), yt.loading ? _jsx(SkeletonRows, { n: 6 }) : yt.error ? _jsx(ErrorState, { error: yt.error, retry: yt.retry }) : _jsx(TrackList, { tracks: popular.length ? popular : yt.data ?? [], showFeatures: false })] })] }));
}
// ---------------- Albums ----------------
const albumKey = (x) => primaryArtist(x.artist) + '|' + x.album;
export function Albums() {
    const t = useT();
    const all = useAll();
    const albums = useMemo(() => {
        const m = new Map();
        all.filter((x) => x.album).forEach((x) => m.set(albumKey(x), [...(m.get(albumKey(x)) ?? []), x]));
        return [...m].sort((a, b) => a[0].localeCompare(b[0]));
    }, [all]);
    return (_jsxs("div", { className: "page", children: [_jsx("div", { className: "page-head", children: _jsx("h1", { className: "h-page", children: t.albums }) }), !albums.length ? _jsx(Empty, { icon: _jsx(Disc, { size: 40, weight: "duotone" }), text: t.noAlbums }) : (_jsx("div", { className: "grid", children: albums.map(([k, ts]) => (_jsx(Card, { title: ts[0].album, sub: primaryArtist(ts[0].artist), art: ts.find((x) => x.artwork)?.artwork ?? null, onOpen: () => navigate({ name: 'album', key: k }), onPlay: () => playQueue(ts) }, k))) }))] }));
}
export function AlbumView({ k }) {
    const t = useT();
    const all = useAll();
    const tracks = useMemo(() => all.filter((x) => x.album && albumKey(x) === k), [all, k]);
    if (!tracks.length)
        return _jsx(Empty, { icon: _jsx(Disc, { size: 40 }), text: t.noAlbums });
    return (_jsxs("div", { className: "page", children: [_jsx(CollectionHeader, { kind: t.albums, title: tracks[0].album, art: tracks.find((x) => x.artwork)?.artwork ?? null, sub: `${primaryArtist(tracks[0].artist)} · ${tracks.length} ${t.songs} · ${totalMin(tracks)} min` }), _jsx(PlayActions, { tracks: tracks }), _jsx(TrackList, { tracks: tracks })] }));
}
export { SkeletonRows };
