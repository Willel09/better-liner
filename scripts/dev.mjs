// Start Vite, then launch Electron pointed at it.
import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electron from 'electron'

const server = await createServer()
await server.listen()
const url = server.resolvedUrls.local[0]
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, LUMEN_DEV_URL: url } })
child.on('close', () => { server.close(); process.exit(0) })
