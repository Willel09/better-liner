const artistKey = (t) => t.artist.toLowerCase().split(/,|&| feat| ft\.?/)[0].trim();
function fisherYates(xs, rand) {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** Reorder so no artist repeats within `gap` positions, keeping the given order as the preference. */
export function spaceArtists(tracks, gap) {
    const pool = [...tracks], out = [];
    while (pool.length) {
        const recent = new Set(out.slice(-gap).map(artistKey));
        let i = pool.findIndex((t) => !recent.has(artistKey(t)));
        if (i < 0) {
            // Every remaining artist is "too recent": take the one heard longest ago.
            const lastSeen = (t) => out.map(artistKey).lastIndexOf(artistKey(t));
            i = pool.reduce((b, t, k) => (lastSeen(t) < lastSeen(pool[b]) ? k : b), 0);
        }
        out.push(pool.splice(i, 1)[0]);
    }
    return out;
}
export function smartShuffle(input, o = {}) {
    const rand = o.rand ?? Math.random;
    const gap = o.artistGap ?? 3;
    const f = o.features ?? {};
    // De-duplicate by id and by (artist, title) — imports often contain the same song twice.
    const seen = new Set();
    const tracks = input.filter((t) => {
        const k = artistKey(t) + '|' + t.title.toLowerCase().trim();
        if (seen.has(t.id) || seen.has(k))
            return false;
        seen.add(t.id);
        seen.add(k);
        return true;
    });
    const recentRank = new Map((o.recent ?? []).slice(0, 50).map((id, i) => [id, i]));
    // Fresh tracks first (random), then recently played ones (least recent first).
    const fresh = fisherYates(tracks.filter((t) => !recentRank.has(t.id)), rand);
    const stale = tracks.filter((t) => recentRank.has(t.id)).sort((a, b) => recentRank.get(b.id) - recentRank.get(a.id));
    let ordered = [...fresh, ...stale];
    if (o.mode === 'genre' || o.mode === 'mood') {
        const key = (t) => (o.mode === 'genre' ? f[t.id]?.genre ?? t.genre : f[t.id]?.mood) ?? '~';
        const groups = new Map();
        ordered.forEach((t) => groups.set(key(t), [...(groups.get(key(t)) ?? []), t]));
        ordered = fisherYates([...groups.values()], rand).flat();
        // Space artists inside each block only, so blocks stay together.
        let i = 0;
        const out = [];
        for (const g of groups.values()) {
            out.push(...spaceArtists(ordered.slice(i, i + g.length), gap));
            i += g.length;
        }
        return out;
    }
    if (o.mode === 'tempo') {
        // Ride up then down: sort by BPM with a little jitter so it isn't a rigid staircase.
        const bpm = (t) => (f[t.id]?.bpm ?? 110) + (rand() - 0.5) * 8;
        const sorted = [...ordered].sort((a, b) => bpm(a) - bpm(b));
        const up = sorted.filter((_, i) => i % 2 === 0), down = sorted.filter((_, i) => i % 2 === 1).reverse();
        return spaceArtists([...up, ...down], Math.min(gap, 2));
    }
    return spaceArtists(ordered, gap);
}
