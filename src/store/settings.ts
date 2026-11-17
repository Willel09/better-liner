import { create } from './create'

export const ACCENTS = { coral: '#ff6f61', amber: '#f2a93b', mint: '#3ec7a0', sky: '#4aa8ff', iris: '#8b7cf6', rose: '#f0628f' }

export const useSettings = create({
  lang: (navigator.language.startsWith('sv') ? 'sv' : 'en') as 'sv' | 'en',
  theme: 'system' as 'system' | 'dark' | 'light',
  accent: 'coral' as keyof typeof ACCENTS,
  crossfade: 0, // seconds
  normalize: false,
  lyricsOffset: 0, // seconds, positive = lyrics earlier
  wordSync: true,
  visuals: true,
  discordId: '',
  volume: 0.8,
}, 'lumen.settings')
