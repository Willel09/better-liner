// Lumen main process: windows, local library, offline downloads, overlay, Discord, deep links.
const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, TouchBar, nativeTheme } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

const DEV_URL = process.env.LUMEN_DEV_URL
const isMac = process.platform === 'darwin'
const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.aiff', '.alac'])

let main = null
let overlay = null
let pendingDeepLink = null

protocol.registerSchemesAsPrivileged([
  { scheme: 'lumen-file', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
])

if (!app.requestSingleInstanceLock()) app.quit()
app.setAsDefaultProtocolClient('lumen')

const dataDir = (...p) => path.join(app.getPath('userData'), ...p)

function loadPage(win, hash = '') {
  if (DEV_URL) win.loadURL(DEV_URL + (hash ? '#' + hash : ''))
  else win.loadFile(path.join(__dirname, '../dist/index.html'), { hash })
}

function glassOptions() {
  // Real OS translucency under the CSS glass: vibrancy on macOS, Mica/acrylic on Windows 11.
  if (isMac) return { vibrancy: 'under-window', visualEffectState: 'active', transparent: true, titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 } }
  if (process.platform === 'win32') return { backgroundMaterial: 'acrylic', titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#ffffff', height: 44 } }
  return { backgroundColor: '#101114', frame: true }
}

function createMain() {
  main = new BrowserWindow({
    width: 1320, height: 840, minWidth: 980, minHeight: 640,
    title: 'Lumen', show: false,
    ...glassOptions(),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  })
  main.once('ready-to-show', () => main.show())
  main.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  main.on('closed', () => { main = null; overlay?.close() })
  main.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) { main.webContents.send('deeplink', pendingDeepLink); pendingDeepLink = null }
  })
  loadPage(main)
  setupTouchBar()
}

function toggleOverlay() {
  if (overlay) { overlay.close(); return }
  overlay = new BrowserWindow({
    width: 380, height: 120, resizable: false, frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: true,
    ...(isMac ? { vibrancy: 'hud', visualEffectState: 'active' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  })
  overlay.setAlwaysOnTop(true, 'floating')
  overlay.setVisibleOnAllWorkspaces(true)
  overlay.on('closed', () => { overlay = null; main?.webContents.send('overlay:state', false) })
  loadPage(overlay, 'overlay')
  main?.webContents.send('overlay:state', true)
}

function handleDeepLink(url) {
  if (!url?.startsWith('lumen://')) return
  if (main && !main.webContents.isLoading()) {
    main.webContents.send('deeplink', url)
    if (main.isMinimized()) main.restore()
    main.focus()
  } else pendingDeepLink = url
}

// ---------- Touch Bar (macOS) ----------
let tbPlay = null
function setupTouchBar() {
  if (!isMac || !TouchBar) return
  const send = (cmd) => () => main?.webContents.send('player:command', cmd)
  tbPlay = new TouchBar.TouchBarButton({ label: '▶︎', click: send('toggle') })
  main.setTouchBar(new TouchBar({ items: [
    new TouchBar.TouchBarButton({ label: '⏮', click: send('prev') }),
    tbPlay,
    new TouchBar.TouchBarButton({ label: '⏭', click: send('next') }),
  ] }))
}

// ---------- Discord Rich Presence ----------
let discord = null
let discordId = ''
async function discordUpdate(clientId, track) {
  try {
    if (!clientId) { await discord?.destroy(); discord = null; return }
    if (!discord || discordId !== clientId) {
      await discord?.destroy().catch(() => {})
      const { Client } = require('@xhayper/discord-rpc')
      discord = new Client({ clientId })
      discordId = clientId
      await discord.login()
    }
    if (!track) return void (await discord.user?.clearActivity())
    await discord.user?.setActivity({
      type: 2, // "Listening to"
      details: track.title.slice(0, 120),
      state: track.artist.slice(0, 120),
      largeImageKey: track.artwork?.startsWith('http') ? track.artwork : undefined,
      startTimestamp: track.paused ? undefined : new Date(Date.now() - track.position * 1000),
      endTimestamp: track.paused || !track.duration ? undefined : new Date(Date.now() + (track.duration - track.position) * 1000),
    })
  } catch {
    discord = null // Discord not running; retried on the next track change.
  }
}

// ---------- Local library ----------
async function walk(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name)
    if (e.isDirectory() && !e.name.startsWith('.')) await walk(p, out)
    else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) out.push(p)
  }
  return out
}

async function readLocal(files) {
  const mm = await import('music-metadata')
  await fs.mkdir(dataDir('covers'), { recursive: true })
  const tracks = []
  for (const file of files) {
    const id = 'local:' + crypto.createHash('sha1').update(file).digest('hex').slice(0, 16)
    let meta = null
    try { meta = await mm.parseFile(file, { duration: true }) } catch { /* unreadable tags: fall back to file name */ }
    const c = meta?.common ?? {}
    let artwork = null
    const pic = c.picture?.[0]
    if (pic) {
      const ext = pic.format.includes('png') ? 'png' : 'jpg'
      const coverPath = dataDir('covers', id.slice(6) + '.' + ext)
      await fs.writeFile(coverPath, pic.data).catch(() => {})
      artwork = 'lumen-file://local/' + encodeURIComponent(coverPath)
    }
    tracks.push({
      id, source: 'local',
      title: c.title || path.basename(file, path.extname(file)),
      artist: c.artist || c.albumartist || 'Unknown artist',
      album: c.album || '',
      duration: Math.round(meta?.format?.duration ?? 0),
      artwork,
      url: 'lumen-file://local/' + encodeURIComponent(file),
      path: file,
    })
  }
  return tracks
}

// ---------- IPC ----------
ipcMain.handle('local:pick', async (_e, kind) => {
  const res = await dialog.showOpenDialog(main, kind === 'folder'
    ? { properties: ['openDirectory', 'multiSelections'] }
    : { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio', extensions: [...AUDIO_EXT].map((x) => x.slice(1)) }] })
  if (res.canceled) return []
  const files = kind === 'folder' ? (await Promise.all(res.filePaths.map((d) => walk(d)))).flat() : res.filePaths
  return readLocal(files)
})

ipcMain.handle('local:exists', async (_e, paths) => Promise.all(paths.map((p) => fs.access(p).then(() => true, () => false))))

ipcMain.handle('download:save', async (_e, { id, url }) => {
  await fs.mkdir(dataDir('downloads'), { recursive: true })
  const file = dataDir('downloads', id.replace(/[^\w-]/g, '_') + '.audio')
  const res = await net.fetch(url)
  if (!res.ok) throw new Error('Download failed: HTTP ' + res.status)
  const tmp = file + '.part'
  await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()))
  await fs.rename(tmp, file) // rename after full write so a crash never leaves a truncated "downloaded" track
  return 'lumen-file://local/' + encodeURIComponent(file)
})

ipcMain.handle('download:remove', async (_e, id) => {
  await fs.rm(dataDir('downloads', id.replace(/[^\w-]/g, '_') + '.audio'), { force: true })
})

ipcMain.handle('cache:clear', async () => {
  await main?.webContents.session.clearCache()
  await fs.rm(dataDir('downloads'), { recursive: true, force: true })
})

ipcMain.handle('cache:size', async () => {
  let total = 0
  for (const sub of ['downloads', 'covers']) {
    for (const f of await fs.readdir(dataDir(sub)).catch(() => [])) total += (await fs.stat(dataDir(sub, f)).catch(() => ({ size: 0 }))).size
  }
  return total
})

ipcMain.on('overlay:toggle', toggleOverlay)
ipcMain.on('overlay:resize', (_e, h) => overlay?.setSize(380, Math.round(h)))
// Main window broadcasts player state; overlay sends commands back.
ipcMain.on('player:state', (_e, state) => {
  overlay?.webContents.send('player:state', state)
  if (tbPlay) tbPlay.label = state?.playing ? '⏸' : '▶︎'
})
ipcMain.on('player:command', (_e, cmd) => main?.webContents.send('player:command', cmd))
ipcMain.on('discord:update', (_e, { clientId, track }) => discordUpdate(clientId, track))
ipcMain.on('window:fullscreen', (_e, on) => main?.setFullScreen(on))
ipcMain.handle('app:info', () => ({ platform: process.platform, version: app.getVersion(), dark: nativeTheme.shouldUseDarkColors }))

// ---------- App lifecycle ----------
app.on('second-instance', (_e, argv) => handleDeepLink(argv.find((a) => a.startsWith('lumen://'))))
app.on('open-url', (e, url) => { e.preventDefault(); handleDeepLink(url) })

app.whenReady().then(() => {
  // Only serve absolute paths the app itself produced (local imports, covers, downloads).
  protocol.handle('lumen-file', (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname.slice(1))
    if (!path.isAbsolute(p)) return new Response('Bad path', { status: 400 })
    return net.fetch(pathToFileURL(p).toString(), { headers: req.headers })
  })
  createMain()
  handleDeepLink(process.argv.find((a) => a.startsWith('lumen://')))
  app.on('activate', () => { if (!main) createMain() })
})

app.on('window-all-closed', () => { if (!isMac) app.quit() })
app.on('before-quit', () => discord?.destroy().catch(() => {}))
