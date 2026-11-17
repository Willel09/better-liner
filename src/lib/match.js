const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\((official|lyrics?|audio|video|hd|hq|visualizer|music video)[^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 || /\d/.test(w)));
const VARIANTS = ['live', 'cover', 'remix', 'karaoke', 'instrumental', 'sped up', 'slowed', 'nightcore', '8d', 'reverb', 'acoustic', 'edit'];
export function matchScore(v, title, artist, duration = 0) {
    const want = tokens(title), got = tokens(v.title + ' ' + v.channel);
    let overlap = 0;
    want.forEach((w) => got.has(w) && overlap++);
    let score = want.size ? overlap / want.size : 0; // 0..1 title coverage
    const firstArtist = norm(artist.split(/,|&| feat| ft\.?| x /i)[0] ?? '');
    if (firstArtist && (norm(v.channel).includes(firstArtist) || norm(v.title).includes(firstArtist)))
        score += 0.6;
    if (norm(v.channel) === firstArtist)
        score += 0.2; // official artist / "Topic" channel
    const vt = norm(v.title), wt = norm(title);
    for (const x of VARIANTS)
        if (vt.includes(x) && !wt.includes(x))
            score -= 0.5;
    if (duration && v.duration) {
        const d = Math.abs(v.duration - duration);
        score += d <= 3 ? 0.4 : d <= 10 ? 0.2 : d > 60 ? -0.6 : 0;
    }
    if (v.duration > 900 && (!duration || duration < 600))
        score -= 1; // hour-long mixes
    return score;
}
export function bestMatch(vs, title, artist, duration = 0) {
    let best = null, bs = 0.6; // below this it's probably the wrong song
    for (const v of vs) {
        const s = matchScore(v, title, artist, duration);
        if (s > bs) {
            bs = s;
            best = v;
        }
    }
    return best;
}
/** Parse pasted track lists: "Artist - Title", "Title by Artist", "Title — Artist" or CSV "Title,Artist". */
export function parseTrackList(text) {
    const out = [];
    for (let line of text.split(/\r?\n/)) {
        line = line.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim();
        if (!line || /^(title|track|song)\s*[,;\t]/i.test(line))
            continue;
        let m;
        if ((m = line.match(/^(.+?)\s+[-–—]\s+(.+)$/)))
            out.push({ artist: m[1].trim(), title: m[2].trim() });
        else if ((m = line.match(/^(.+?)\s+by\s+(.+)$/i)))
            out.push({ title: m[1].trim(), artist: m[2].trim() });
        else if ((m = line.match(/^"?([^",;\t]+)"?\s*[,;\t]\s*"?([^",;\t]+)"?/)))
            out.push({ title: m[1].trim(), artist: m[2].trim() });
        else
            out.push({ title: line, artist: '' });
    }
    return out;
}
