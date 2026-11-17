// Thin layer over the Rust backend. Outside Tauri (plain browser during UI work) calls fail softly.
import { invoke as tauriInvoke, convertFileSrc } from '@tauri-apps/api/core';
import { emit as tauriEmit, emitTo as tauriEmitTo, listen as tauriListen } from '@tauri-apps/api/event';
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
function invoke(cmd, args) {
    if (!isTauri)
        return Promise.reject(new Error('desktop-only'));
    return tauriInvoke(cmd, args);
}
export const api = {
    platform: () => invoke('platform'),
    configStatus: () => invoke('config_status'),
    configSet: (patch) => invoke('config_set', { patch }),
    ytSearch: (q, max = 15) => invoke('yt_search', { q, max }),
    ai: (messages, json = false, cacheKey) => invoke('ai_chat', { messages, json, cacheKey }),
    aiModels: () => invoke('ai_models'),
    importPlaylist: (url) => invoke('import_playlist', { url }),
    localScan: (paths) => invoke('local_scan', { paths }),
    localAllow: (paths) => invoke('local_allow', { paths }),
    analyze: (path) => invoke('analyze_file', { path }),
    playLog: (a) => invoke('play_log', a),
    stats: (days) => invoke('stats', { days, tzOffsetMin: -new Date().getTimezoneOffset() }),
    miniToggle: () => invoke('mini_toggle'),
    ytmOpen: (url, focus = true) => invoke('ytm_open', { url, focus }),
    discord: (clientId, t) => invoke('discord_update', { clientId, title: t?.title, artist: t?.artist, start: t?.start, end: t?.end }).catch(() => { }),
};
export const fileSrc = (path) => (isTauri ? convertFileSrc(path) : path);
export function emit(event, payload) {
    if (isTauri)
        tauriEmit(event, payload).catch(() => { });
}
export function emitTo(target, event, payload) {
    if (isTauri)
        tauriEmitTo(target, event, payload).catch(() => { });
}
export const ytmSearchUrl = (q) => 'https://music.youtube.com/search?q=' + encodeURIComponent(q);
export function listen(event, cb) {
    if (!isTauri)
        return () => { };
    let off = null, dead = false;
    tauriListen(event, (e) => cb(e.payload)).then((u) => (dead ? u() : (off = u)));
    return () => { dead = true; off?.(); };
}
/** Human message for backend error codes. */
export function errText(e, sv) {
    const m = String(e?.message ?? e);
    const map = {
        'youtube:nokey': ['Lägg till en YouTube API-nyckel i Inställningar → Integrationer.', 'Add a YouTube API key in Settings → Integrations.'],
        'youtube:quota': ['YouTube-kvoten för idag är slut. Den återställs vid midnatt (Stillahavstid).', 'Today’s YouTube quota is used up. It resets at midnight Pacific time.'],
        'youtube:key': ['YouTube-nyckeln är ogiltig.', 'The YouTube key is invalid.'],
        'ai:nokey': ['Välj en AI-leverantör och lägg till en nyckel i Inställningar → Integrationer.', 'Pick an AI provider and add a key in Settings → Integrations.'],
        'ai:nomodel': ['Välj en AI-modell i Inställningar → Integrationer.', 'Choose an AI model in Settings → Integrations.'],
        'ai:refusal': ['AI:n avböjde förfrågan.', 'The AI declined this request.'],
        'import:unsupported': ['Länken stöds inte. Klistra in låtlistan som text i stället.', 'Unsupported link. Paste the track list as text instead.'],
        'import:spotify-nokey': ['Spotify-import kräver ett Client ID och Secret i Inställningar → Integrationer.', 'Spotify import needs a Client ID and Secret in Settings → Integrations.'],
        'youtube:150': ['Den här videon får inte spelas utanför YouTube.', 'This video can’t be played outside YouTube.'],
        'youtube:101': ['Den här videon får inte spelas utanför YouTube.', 'This video can’t be played outside YouTube.'],
        'youtube:153': ['YouTube-spelaren saknar giltig ursprungsadress.', 'The YouTube player is missing a valid origin.'],
        'nomatch': ['Hittade ingen matchande låt på YouTube.', 'No matching song found on YouTube.'],
        'desktop-only': ['Fungerar bara i skrivbordsappen.', 'Only works in the desktop app.'],
    };
    const hit = Object.keys(map).find((k) => m.includes(k));
    return hit ? map[hit][sv ? 0 : 1] : m.replace(/^(ai|youtube|import):/, '');
}
