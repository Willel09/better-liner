import { createRoot } from 'react-dom/client'
import './styles.css'
import { api, isTauri } from './lib/api'
import { ACCENTS, useSettings } from './store/settings'

const isMini = location.hash === '#mini'
const root = document.documentElement

const dark = matchMedia('(prefers-color-scheme: dark)')
function applyTheme() {
  const s = useSettings.get()
  // Now Playing and the mini player are always dark; elsewhere follow the setting.
  root.dataset.theme = isMini ? 'dark' : s.theme === 'system' ? (dark.matches ? 'dark' : 'light') : s.theme
  root.style.setProperty('--accent', ACCENTS[s.accent])
  root.lang = s.lang
}
applyTheme()
useSettings.subscribe(applyTheme)
dark.addEventListener('change', applyTheme)
addEventListener('storage', (e) => { if (e.key === 'lumen.settings' && e.newValue) useSettings.set(JSON.parse(e.newValue)) })
if (isTauri) api.platform().then((p) => { if (p === 'macos' || p === 'windows') root.classList.add('vibrant') })

const mount = document.getElementById('root')!
if (isMini) {
  document.body.style.background = 'transparent'
  import('./Overlay').then(({ Mini }) => createRoot(mount).render(<Mini />))
} else {
  Promise.all([import('./App'), import('./store/bridge'), import('./store/status'), import('./store/library')]).then(([{ App }, { startBridge }, { refreshStatus }, { useLibrary }]) => {
    startBridge()
    refreshStatus()
    // Asset access to local files resets each launch; re-grant for files already in the library.
    const s = useLibrary.get()
    const paths = s.local.map((id) => s.tracks[id]?.path).filter(Boolean) as string[]
    if (isTauri && paths.length) api.localAllow(paths).catch(() => {})
    createRoot(mount).render(<App />)
  })
}
