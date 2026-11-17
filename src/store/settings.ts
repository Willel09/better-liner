import type { ShuffleMode } from '../lib/shuffle'
import { create } from './create'

export const ACCENTS = { coral: '#ff6f61', amber: '#f2a93b', mint: '#3ec7a0', sky: '#4aa8ff', iris: '#8b7cf6', rose: '#f0628f' }

export const AI_PRESETS = {
  mistral: { base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', label: 'Mistral' },
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', label: 'DeepSeek' },
  custom: { base: '', model: '', label: 'OpenAI-compatible' },
} as const

export const EQ_BANDS = [60, 230, 910, 3600, 14000] as const
export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0], bass: [6, 3, 0, 0, 0], vocal: [-2, 0, 3, 3, 1], bright: [0, 0, 0, 3, 5], night: [-3, 0, 1, 0, -4],
}

export const useSettings = create({
  lang: (navigator.language.startsWith('sv') ? 'sv' : 'en') as 'sv' | 'en',
  theme: 'system' as 'system' | 'dark' | 'light',
  accent: 'coral' as keyof typeof ACCENTS,
  // audio
  volume: 0.8,
  crossfade: 6, // seconds, 0 = off
  autoGain: true,
  eq: [0, 0, 0, 0, 0],
  shuffleMode: 'random' as ShuffleMode,
  artistGap: 3,
  // lyrics & visuals
  lyricsOffset: 0,
  wordSync: true,
  visuals: true,
  // behaviour
  privateSession: false,
  smartRadio: true,
  djVoice: false,
  discordId: '',
  aiPreset: 'mistral' as keyof typeof AI_PRESETS,
  ytSearchesToday: [0, ''] as [number, string], // quota estimate: [count, yyyy-mm-dd]
}, 'lumen.settings')

export function countYtSearch() {
  const today = new Date().toISOString().slice(0, 10)
  const [n, d] = useSettings.get().ytSearchesToday
  useSettings.set({ ytSearchesToday: [d === today ? n + 1 : 1, today] })
}
