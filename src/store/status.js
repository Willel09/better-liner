import { api } from '../lib/api';
import { create } from './create';
// Which integrations are configured (never the keys themselves).
export const useStatus = create({ youtube: false, ai: false, ai_base: '', ai_model: '', ai_protocol: '', spotify: false });
export const refreshStatus = () => api.configStatus().then((s) => useStatus.set(s)).catch(() => { });
