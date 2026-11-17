import { describe, expect, it } from 'vitest';
import { activeLine, parseLrc } from './lrc';
describe('parseLrc', () => {
    it('parses line-synced lyrics, sorts, and sets end times', () => {
        const l = parseLrc('[00:05.50] second\n[ar:Someone]\n[00:01.00]first\n[01:02.123]third', 70);
        expect(l.map((x) => [x.time, x.text])).toEqual([[1, 'first'], [5.5, 'second'], [62.123, 'third']]);
        expect(l[0].end).toBe(5.5);
        expect(l[2].end).toBe(70);
    });
    it('expands repeated timestamps', () => {
        const l = parseLrc('[00:10.00][00:20.00]chorus');
        expect(l.map((x) => x.time)).toEqual([10, 20]);
    });
    it('parses word-level enhanced LRC', () => {
        const [line] = parseLrc('[00:01.00]<00:01.00>la <00:01.50>da <00:02.00>dee', 3);
        expect(line.text).toBe('la da dee');
        expect(line.words.map((w) => [w.time, w.end, w.text])).toEqual([[1, 1.5, 'la '], [1.5, 2, 'da '], [2, 3, 'dee']]);
    });
});
describe('activeLine', () => {
    const l = parseLrc('[00:01.00]a\n[00:03.00]b\n[00:05.00]c');
    it('finds the current line', () => {
        expect(activeLine(l, 0)).toBe(-1);
        expect(activeLine(l, 1)).toBe(0);
        expect(activeLine(l, 4.9)).toBe(1);
        expect(activeLine(l, 99)).toBe(2);
    });
});
