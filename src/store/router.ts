import type { Route } from '../lib/types'
import { create } from './create'

export const useRouter = create({ stack: [{ name: 'home' }] as Route[], pos: 0 })

export const route = () => { const s = useRouter.get(); return s.stack[s.pos] }

export function navigate(r: Route) {
  useRouter.set((s) => ({ stack: [...s.stack.slice(0, s.pos + 1), r].slice(-50), pos: Math.min(s.pos + 1, 49) }))
}
export const back = () => useRouter.set((s) => ({ pos: Math.max(0, s.pos - 1) }))
export const forward = () => useRouter.set((s) => ({ pos: Math.min(s.stack.length - 1, s.pos + 1) }))
