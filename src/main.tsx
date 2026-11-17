import { createRoot } from 'react-dom/client'
import './styles.css'
import { useSettings, ACCENTS } from './store/settings'

const isOverlay = location.hash === '#overlay'
const root = document.documentElement

// Theme + accent follow settings (and the OS when theme = system).
const dark = matchMedia('(prefers-color-scheme: dark)')
function applyTheme() {
  const s = useSettings.get()
  root.dataset.theme = s.theme === 'system' ? (dark.matches ? 'dark' : 'light') : s.theme
  root.style.setProperty('--accent', ACCENTS[s.accent])
  root.lang = s.lang
}
applyTheme()
useSettings.subscribe(applyTheme)
dark.addEventListener('change', applyTheme)
window.lumen?.info().then((i) => { if (i.platform === 'darwin') root.classList.add('vibrant') })
// Overlay window reads theme/accent from its own copy of localStorage; refresh it when the main window changes them.
addEventListener('storage', (e) => { if (e.key === 'lumen.settings' && e.newValue) useSettings.set(JSON.parse(e.newValue)) })

if (isOverlay) {
  document.body.style.background = 'transparent'
  import('./Overlay').then(({ Overlay }) => createRoot(document.getElementById('root')!).render(<Overlay />))
} else {
  Promise.all([import('./App'), import('./store/bridge')]).then(([{ App }, { startBridge }]) => {
    startBridge()
    createRoot(document.getElementById('root')!).render(<App />)
  })
}
