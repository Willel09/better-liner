import { describe, expect, it } from 'vitest';
import { bestMatch, matchScore, parseTrackList } from './match';
const v = (title, channel, duration) => ({ id: title, title, channel, thumb: '', duration });
describe('bestMatch', () => {
    const results = [
        v('Night Drive (Live at Somewhere)', 'Neon Lake', 260),
        v('Night Drive (Official Audio)', 'Neon Lake - Topic', 214),
        v('Night Drive - Karaoke Version', 'Sing Along Hits', 214),
        v('Totally Different Song', 'Neon Lake', 214),
    ];
    it('prefers the official version with matching duration', () => {
        expect(bestMatch(results, 'Night Drive', 'Neon Lake', 213)?.title).toBe('Night Drive (Official Audio)');
    });
    it('returns null when nothing plausibly matches', () => {
        expect(bestMatch([v('Cooking tutorial', 'Chef', 600)], 'Night Drive', 'Neon Lake')).toBeNull();
    });
    it('penalizes variants not asked for', () => {
        expect(matchScore(results[2], 'Night Drive', 'Neon Lake')).toBeLessThan(matchScore(results[1], 'Night Drive', 'Neon Lake'));
    });
});
describe('parseTrackList', () => {
    it('handles common pasted formats', () => {
        expect(parseTrackList('1. Neon Lake - Night Drive\nMorning Light by Paper Boats\n"Glass Heart",Iris Vale\n\nJust A Title')).toEqual([
            { artist: 'Neon Lake', title: 'Night Drive' },
            { title: 'Morning Light', artist: 'Paper Boats' },
            { title: 'Glass Heart', artist: 'Iris Vale' },
            { title: 'Just A Title', artist: '' },
        ]);
    });
});
