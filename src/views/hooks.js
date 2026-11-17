import { useEffect, useState } from 'react';
// Load async data keyed by deps; exposes loading/error/retry. Pass `enabled=false` to skip.
export function useAsync(fn, deps, enabled = true) {
    const [state, setState] = useState({ loading: enabled });
    const [nonce, setNonce] = useState(0);
    useEffect(() => {
        if (!enabled) {
            setState({ loading: false });
            return;
        }
        let live = true;
        setState((s) => ({ data: s.data, loading: true }));
        fn().then((data) => live && setState({ data, loading: false }), (error) => live && setState({ error, loading: false }));
        return () => { live = false; };
    }, [...deps, nonce, enabled]);
    return { ...state, retry: () => setNonce((n) => n + 1) };
}
