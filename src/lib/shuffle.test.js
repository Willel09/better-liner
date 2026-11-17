import { describe, expect, it } from 'vitest';
import { smartShuffle, spaceArtists } from './shuffle';
const tr = (id, artist, extra = {}) => ({ id, source: 'yt', title: 'Song ' + id, artist, duration: 200, artwork: null, ...extra });
function seeded(seed = 7) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
describe('smartShuffle', () => {
    const lib = [
        ...Array.from({ length: 6 }, (_, i) => tr('a' + i, 'Alpha')),
        ...Array.from({ length: 6 }, (_, i) => tr('b' + i, 'Beta')),
        ...Array.from({ length: 6 }, (_, i) => tr('c' + i, 'Gamma')),
        ...Array.from({ length: 6 }, (_, i) => tr('d' + i, 'Delta')),
    ];
    it('never repeats an artist within the gap when the pool allows it', () => {
        for (let s = 1; s < 30; s++) {
            const out = smartShuffle(lib, { artistGap: 3, rand: seeded(s) });
            for (let i = 1; i < out.length; i++) {
                const window = out.slice(Math.max(0, i - 3), i).map((t) => t.artist);
                expect(window).not.toContain(out[i].artist);
            }
        }
    });
    it('keeps every track exactly once and drops duplicates', () => {
        const dup = [...lib, lib[0], tr('x', 'Alpha', { title: 'Song a1' })];
        const out = smartShuffle(dup, { rand: seeded() });
        expect(out).toHaveLength(lib.length);
        expect(new Set(out.map((t) => t.id)).size).toBe(lib.length);
    });
    it('pushes recently played tracks to the end', () => {
        const out = smartShuffle(lib, { recent: ['a0', 'b0'], rand: seeded() });
        expect(out.slice(-4).map((t) => t.id)).toEqual(expect.arrayContaining(['a0', 'b0']));
    });
    it('groups by mood', () => {
        const features = Object.fromEntries(lib.map((t, i) => [t.id, { mood: i % 2 ? 'chill' : 'happy' }]));
        const out = smartShuffle(lib, { mode: 'mood', features, rand: seeded() });
        const moods = out.map((t) => features[t.id].mood);
        const switches = moods.filter((m, i) => i > 0 && m !== moods[i - 1]).length;
        expect(switches).toBe(1);
    });
    it('tempo mode rises then falls', () => {
        const features = Object.fromEntries(lib.map((t, i) => [t.id, { bpm: 70 + i * 5 }]));
        const out = smartShuffle(lib, { mode: 'tempo', features, rand: seeded() });
        const bpms = out.map((t) => features[t.id].bpm);
        const peak = bpms.indexOf(Math.max(...bpms));
        expect(peak).toBeGreaterThan(4);
        expect(peak).toBeLessThan(bpms.length - 4);
        expect(bpms[0]).toBeLessThan(100);
        expect(bpms[bpms.length - 1]).toBeLessThan(100);
    });
});
describe('spaceArtists', () => {
    it('falls back gracefully when one artist dominates', () => {
        const out = spaceArtists([tr('1', 'A'), tr('2', 'A'), tr('3', 'A'), tr('4', 'B')], 2);
        expect(out).toHaveLength(4);
        expect(out[1].artist).toBe('B');
    });
});
