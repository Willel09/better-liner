import { useSettings } from '../store/settings'

const sv = {
  home: 'Hem', search: 'Sök', library: 'Bibliotek', liked: 'Gillade låtar', local: 'Lokala filer', downloads: 'Nedladdat',
  history: 'Senast spelat', playlists: 'Spellistor', newPlaylist: 'Ny spellista', settings: 'Inställningar',
  trending: 'Trendar den här veckan', trendingPlaylists: 'Populära spellistor', recent: 'Hoppa in igen', genres: 'Genrer',
  searchPlaceholder: 'Låtar, artister, album', tracks: 'Låtar', artists: 'Artister', albums: 'Album', noResults: 'Inga träffar för',
  play: 'Spela', shuffle: 'Blanda', pause: 'Pausa', next: 'Nästa', prev: 'Föregående', repeat: 'Upprepa', queue: 'Kö', lyrics: 'Lyrics',
  upNext: 'Härnäst', clearQueue: 'Rensa kö', noLyrics: 'Inga lyrics hittades för den här låten.', loadingLyrics: 'Hämtar lyrics…',
  like: 'Gilla', unlike: 'Sluta gilla', addToQueue: 'Lägg i kö', playNext: 'Spela härnäst', addToPlaylist: 'Lägg till i spellista',
  download: 'Ladda ner', removeDownload: 'Ta bort nedladdning', removeFromPlaylist: 'Ta bort från spellista', goToArtist: 'Gå till artist',
  copyLink: 'Kopiera länk', importFolder: 'Importera mapp', importFiles: 'Importera filer', rename: 'Byt namn', delete: 'Radera',
  emptyLiked: 'Gilla låtar så hamnar de här.', emptyLocal: 'Importera en mapp med musik från datorn.', emptyDownloads: 'Ladda ner låtar för att lyssna offline.',
  emptyHistory: 'Det du spelar visas här.', emptyPlaylist: 'Spellistan är tom. Lägg till låtar från menyn på en låt.',
  followers: 'följare', popular: 'Populärt', offline: 'Du är offline. Bara nedladdade och lokala låtar kan spelas.',
  language: 'Språk', appearance: 'Utseende', accent: 'Accentfärg', theme: 'Tema', system: 'System', dark: 'Mörkt', light: 'Ljust',
  playback: 'Uppspelning', crossfade: 'Övertoning', normalize: 'Jämna ut volym', lyricsSettings: 'Lyrics', lyricsOffset: 'Förskjutning',
  wordSync: 'Visa ord-synk när det finns', visuals: 'Reaktiva visuals', visualsHint: 'Bakgrunden pulserar med musiken.',
  discord: 'Discord-status', discordHint: 'Klient-ID från en egen Discord-app. Lämna tomt för att stänga av.',
  storage: 'Lagring', cache: 'Cache och nedladdningar', clearCache: 'Rensa cache', shortcuts: 'Kortkommandon', about: 'Om',
  miniPlayer: 'Miniplayer', fullscreen: 'Helskärm', exitFullscreen: 'Lämna helskärm', volume: 'Volym', mute: 'Ljud av',
  nothingPlaying: 'Inget spelas', nowPlaying: 'Spelas nu', all: 'Allt', follow: 'Följ', following: 'Följer', morning: 'God morgon', afternoon: 'God eftermiddag', evening: 'God kväll', more: 'Fler val', close: 'Stäng', remove: 'Ta bort', yourMusic: 'Din musik', songs: 'låtar', playlistName: 'Namn på spellista', create: 'Skapa', cancel: 'Avbryt', save: 'Spara',
  error: 'Något gick fel. Försök igen.', retry: 'Försök igen', copied: 'Länk kopierad', downloaded: 'Nedladdad', downloading: 'Laddar ner…',
}
type Dict = typeof sv
const en: Dict = {
  home: 'Home', search: 'Search', library: 'Library', liked: 'Liked songs', local: 'Local files', downloads: 'Downloads',
  history: 'Recently played', playlists: 'Playlists', newPlaylist: 'New playlist', settings: 'Settings',
  trending: 'Trending this week', trendingPlaylists: 'Popular playlists', recent: 'Jump back in', genres: 'Genres',
  searchPlaceholder: 'Songs, artists, albums', tracks: 'Songs', artists: 'Artists', albums: 'Albums', noResults: 'No results for',
  play: 'Play', shuffle: 'Shuffle', pause: 'Pause', next: 'Next', prev: 'Previous', repeat: 'Repeat', queue: 'Queue', lyrics: 'Lyrics',
  upNext: 'Up next', clearQueue: 'Clear queue', noLyrics: 'No lyrics found for this song.', loadingLyrics: 'Fetching lyrics…',
  like: 'Like', unlike: 'Unlike', addToQueue: 'Add to queue', playNext: 'Play next', addToPlaylist: 'Add to playlist',
  download: 'Download', removeDownload: 'Remove download', removeFromPlaylist: 'Remove from playlist', goToArtist: 'Go to artist',
  copyLink: 'Copy link', importFolder: 'Import folder', importFiles: 'Import files', rename: 'Rename', delete: 'Delete',
  emptyLiked: 'Songs you like show up here.', emptyLocal: 'Import a folder of music from your computer.', emptyDownloads: 'Download songs to listen offline.',
  emptyHistory: 'What you play shows up here.', emptyPlaylist: 'This playlist is empty. Add songs from a song’s menu.',
  followers: 'followers', popular: 'Popular', offline: 'You are offline. Only downloaded and local songs can play.',
  language: 'Language', appearance: 'Appearance', accent: 'Accent color', theme: 'Theme', system: 'System', dark: 'Dark', light: 'Light',
  playback: 'Playback', crossfade: 'Crossfade', normalize: 'Normalize volume', lyricsSettings: 'Lyrics', lyricsOffset: 'Offset',
  wordSync: 'Show word sync when available', visuals: 'Reactive visuals', visualsHint: 'The background pulses with the music.',
  discord: 'Discord status', discordHint: 'Client ID from your own Discord app. Leave empty to turn off.',
  storage: 'Storage', cache: 'Cache and downloads', clearCache: 'Clear cache', shortcuts: 'Shortcuts', about: 'About',
  miniPlayer: 'Mini player', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', volume: 'Volume', mute: 'Mute',
  nothingPlaying: 'Nothing playing', nowPlaying: 'Now playing', all: 'All', follow: 'Follow', following: 'Following', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', more: 'More', close: 'Close', remove: 'Remove', yourMusic: 'Your music', songs: 'songs', playlistName: 'Playlist name', create: 'Create', cancel: 'Cancel', save: 'Save',
  error: 'Something went wrong. Try again.', retry: 'Try again', copied: 'Link copied', downloaded: 'Downloaded', downloading: 'Downloading…',
}

export const LANGS = { sv: 'Svenska', en: 'English' } as const
const dicts = { sv, en }

export function useT() {
  const lang = useSettings((s) => s.lang)
  return dicts[lang] ?? en
}
