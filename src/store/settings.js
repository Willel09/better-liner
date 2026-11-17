import { create } from './create';
export const ACCENTS = { coral: '#ff6f61', amber: '#f2a93b', mint: '#3ec7a0', sky: '#4aa8ff', iris: '#8b7cf6', rose: '#f0628f' };
// Any provider works: these presets only fill in the address and a starting model.
// "Fetch models" in Settings lists what the provider actually offers.
export const AI_PRESETS = {
    openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', protocol: 'openai' },
    anthropic: { label: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1', model: 'claude-opus-5-5', protocol: 'anthropic' },
    gemini: { label: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', protocol: 'openai' },
    mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', protocol: 'openai' },
    deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', protocol: 'openai' },
    groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', protocol: 'openai' },
    openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', protocol: 'openai' },
    xai: { label: 'xAI (Grok)', base: 'https://api.x.ai/v1', model: 'grok-3-mini', protocol: 'openai' },
    together: { label: 'Together AI', base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', protocol: 'openai' },
    ollama: { label: 'Ollama (lokal)', base: 'http://localhost:11434/v1', model: 'llama3.2', protocol: 'openai' },
    lmstudio: { label: 'LM Studio (lokal)', base: 'http://localhost:1234/v1', model: '', protocol: 'openai' },
    custom: { label: 'Annan (OpenAI-kompatibel)', base: '', model: '', protocol: 'openai' },
};
export const EQ_BANDS = [60, 230, 910, 3600, 14000];
export const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0], bass: [6, 3, 0, 0, 0], vocal: [-2, 0, 3, 3, 1], bright: [0, 0, 0, 3, 5], night: [-3, 0, 1, 0, -4],
};
export const useSettings = create({
    lang: (navigator.language.startsWith('sv') ? 'sv' : 'en'),
    theme: 'system',
    accent: 'coral',
    // audio
    volume: 0.8,
    crossfade: 6, // seconds, 0 = off
    autoGain: true,
    eq: [0, 0, 0, 0, 0],
    shuffleMode: 'random',
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
    aiPreset: 'mistral',
    ytSearchesToday: [0, ''], // quota estimate: [count, yyyy-mm-dd]
}, 'echo.settings');
export function countYtSearch() {
    const today = new Date().toISOString().slice(0, 10);
    const [n, d] = useSettings.get().ytSearchesToday;
    useSettings.set({ ytSearchesToday: [d === today ? n + 1 : 1, today] });
}
