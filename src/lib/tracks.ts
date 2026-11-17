import { api, fileSrc, type LocalTrack, type YtVideo } from './api'
import type { Track } from './types'
import { countYtSearch } from '../store/settings'

const NOISE = /\s*[([](official|lyrics?|audio|video|hd|hq|4k|visuali[sz]er|music video|mv|clip officiel)[^)\]]*[)\]]/gi

/** Turn a YouTube result into a Track: strip "(Official Video)" etc., split "Artist - Title" when present. */
export function ytToTrack(v: YtVideo): Track {
  let title = v.title.replace(NOISE, '').trim()
  let artist = v.channel
  const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (m) { artist = m[1].trim(); title = m[2].trim() }
  return { id: 'yt:' + v.id, source: 'yt', title, artist, duration: v.duration, artwork: v.thumb, videoId: v.id }
}

export async function searchYt(q: string, max = 15): Promise<Track[]> {
  countYtSearch()
  return (await api.ytSearch(q, max)).map(ytToTrack)
}

export const localToTrack = (l: LocalTrack): Track => ({
  id: l.id, source: 'local', title: l.title, artist: l.artist, album: l.album || undefined, genre: l.genre || undefined,
  duration: l.duration, artwork: l.cover ? fileSrc(l.cover) : null, path: l.path,
})

export const primaryArtist = (a: string) => a.split(/,|&| feat\.?| ft\.?| x /i)[0].trim() || a
