import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowClockwise, CheckCircle, DownloadSimple } from '@phosphor-icons/react';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { useEffect, useState } from 'react';
import { isTauri } from '../lib/api';
import { useT } from '../lib/i18n';
/** "Update app" — checks GitHub Releases, downloads the signed update and restarts into it. */
export function UpdateCard() {
    const t = useT();
    const [version, setVersion] = useState('');
    const [st, setSt] = useState({ kind: 'idle' });
    useEffect(() => { if (isTauri)
        getVersion().then(setVersion); }, []);
    const run = async () => {
        setSt({ kind: 'checking' });
        try {
            const update = await check();
            setSt(update ? { kind: 'available', update } : { kind: 'latest' });
        }
        catch (e) {
            setSt({ kind: 'error', msg: String(e?.message ?? e) });
        }
    };
    const install = async (update) => {
        let total = 0, got = 0;
        setSt({ kind: 'downloading', pct: 0 });
        try {
            await update.downloadAndInstall((ev) => {
                if (ev.event === 'Started')
                    total = ev.data.contentLength ?? 0;
                if (ev.event === 'Progress') {
                    got += ev.data.chunkLength;
                    setSt({ kind: 'downloading', pct: total ? got / total : 0 });
                }
            });
            await relaunch();
        }
        catch (e) {
            setSt({ kind: 'error', msg: String(e?.message ?? e) });
        }
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: { minWidth: 0, flex: 1 }, children: [_jsx("div", { style: { fontWeight: 550 }, children: t.updates }), _jsxs("div", { className: "hint", children: [t.version, " ", version || '–', st.kind === 'latest' && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx(CheckCircle, { size: 12, weight: "fill", color: "#34c759", style: { verticalAlign: -1 } }), " ", t.upToDate] }), st.kind === 'available' && _jsxs(_Fragment, { children: [" \u00B7 ", t.updateAvailable, " ", st.update.version] }), st.kind === 'error' && _jsxs(_Fragment, { children: [" \u00B7 ", _jsx("span", { style: { color: 'var(--accent)' }, children: t.updateFailed })] })] }), st.kind === 'available' && st.update.body && _jsx("div", { className: "hint", style: { whiteSpace: 'pre-wrap', marginTop: 6 }, children: st.update.body }), st.kind === 'downloading' && _jsx("div", { className: "progress-line", style: { marginTop: 8, maxWidth: 320 }, children: _jsx("i", { style: { width: `${Math.round(st.pct * 100)}%` } }) })] }), st.kind === 'available'
                ? _jsxs("button", { className: "btn primary", onClick: () => install(st.update), children: [_jsx(DownloadSimple, { size: 16 }), t.installRestart] })
                : _jsxs("button", { className: "btn", disabled: !isTauri || st.kind === 'checking' || st.kind === 'downloading', onClick: run, children: [_jsx(ArrowClockwise, { size: 16, className: st.kind === 'checking' ? 'spin' : undefined }), st.kind === 'downloading' ? t.downloadingUpdate : t.checkUpdates] })] }));
}
