import { useEffect, useState } from 'react'

// Load async data keyed by deps; exposes loading/error/retry.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let live = true
    setState({ loading: true })
    fn().then((data) => live && setState({ data, loading: false }), (error) => live && setState({ error, loading: false }))
    return () => { live = false }
  }, [...deps, nonce])
  return { ...state, retry: () => setNonce((n) => n + 1) }
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    addEventListener('online', up); addEventListener('offline', down)
    return () => { removeEventListener('online', up); removeEventListener('offline', down) }
  }, [])
  return on
}
