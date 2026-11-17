import { useSyncExternalStore } from 'react'

// Minimal zustand-style store, optionally persisted to localStorage.
export function create<S extends object>(init: S, persistKey?: string) {
  let state = init
  if (persistKey) {
    // Fall back to the pre-rename key ("lumen.*") once, so existing libraries carry over.
    try { state = { ...init, ...JSON.parse(localStorage.getItem(persistKey) ?? localStorage.getItem(persistKey.replace(/^echo\./, 'lumen.')) ?? '{}') } } catch { /* corrupt or unavailable storage: start fresh */ }
  }
  const subs = new Set<() => void>()
  const get = () => state
  const set = (patch: Partial<S> | ((s: S) => Partial<S>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    if (persistKey) try { localStorage.setItem(persistKey, JSON.stringify(state)) } catch { /* quota: keep in memory */ }
    subs.forEach((f) => f())
  }
  const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
  function use(): S
  function use<T>(sel: (s: S) => T): T
  function use<T>(sel?: (s: S) => T) {
    return useSyncExternalStore(subscribe, () => (sel ? sel(state) : state))
  }
  return Object.assign(use, { get, set, subscribe })
}
