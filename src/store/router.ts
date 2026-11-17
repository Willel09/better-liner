import type { Route } from '../lib/types'
import { create } from './create'

export const useRouter = create({ stack: [{ name: 'home' }] as Route[], pos: 0 })
export const route = () => { const s = useRouter.get(); return s.stack[s.pos] }

export function navigate(r: Route) {
  if (JSON.stringify(route()) === JSON.stringify(r)) return
  useRouter.set((s) => {
    const stack = [...s.stack.slice(0, s.pos + 1), r].slice(-50)
    return { stack, pos: stack.length - 1 }
  })
}
export const back = () => useRouter.set((s) => ({ pos: Math.max(0, s.pos - 1) }))
export const forward = () => useRouter.set((s) => ({ pos: Math.min(s.stack.length - 1, s.pos + 1) }))
