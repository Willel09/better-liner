const TS = /(\d+):(\d{1,2})(?:[.:](\d{1,3}))?/;
const toSec = (m) => +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 10 ** m[3].length : 0);
export function parseLrc(src, duration = 0) {
    const lines = [];
    for (const raw of src.split(/\r?\n/)) {
        const stamps = [...raw.matchAll(/\[(\d+:\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
        if (!stamps.length)
            continue;
        const body = raw.slice(stamps[stamps.length - 1].index + stamps[stamps.length - 1][0].length);
        const words = [];
        for (const m of body.matchAll(/<([^>]+)>([^<]*)/g)) {
            const t = m[1].match(TS);
            if (t && m[2])
                words.push({ time: toSec(t), end: 0, text: m[2] });
        }
        const text = body.replace(/<[^>]+>/g, '').trim();
        for (const s of stamps)
            lines.push({ time: toSec(s[1].match(TS)), end: 0, text, words: words.map((w) => ({ ...w })) });
    }
    lines.sort((a, b) => a.time - b.time);
    lines.forEach((l, i) => {
        l.end = lines[i + 1]?.time ?? (duration > l.time ? duration : l.time + 5);
        l.words.forEach((w, j) => (w.end = l.words[j + 1]?.time ?? l.end));
    });
    return lines;
}
// Index of the line playing at time t (binary search), -1 before the first line.
export function activeLine(lines, t) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].time <= t) {
            ans = mid;
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return ans;
}
