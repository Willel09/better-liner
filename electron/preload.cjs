const { contextBridge, ipcRenderer } = require('electron')

const on = (channel) => (cb) => {
  const fn = (_e, v) => cb(v)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

contextBridge.exposeInMainWorld('lumen', {
  pickLocal: (kind) => ipcRenderer.invoke('local:pick', kind),
  localExists: (paths) => ipcRenderer.invoke('local:exists', paths),
  download: (id, url) => ipcRenderer.invoke('download:save', { id, url }),
  removeDownload: (id) => ipcRenderer.invoke('download:remove', id),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  cacheSize: () => ipcRenderer.invoke('cache:size'),
  info: () => ipcRenderer.invoke('app:info'),
  toggleOverlay: () => ipcRenderer.send('overlay:toggle'),
  resizeOverlay: (h) => ipcRenderer.send('overlay:resize', h),
  sendState: (s) => ipcRenderer.send('player:state', s),
  sendCommand: (c) => ipcRenderer.send('player:command', c),
  discord: (clientId, track) => ipcRenderer.send('discord:update', { clientId, track }),
  setFullscreen: (on) => ipcRenderer.send('window:fullscreen', on),
  onState: on('player:state'),
  onCommand: on('player:command'),
  onOverlay: on('overlay:state'),
  onDeepLink: on('deeplink'),
})
