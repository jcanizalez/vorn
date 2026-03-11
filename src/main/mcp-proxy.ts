import net from 'node:net'
import fs from 'node:fs'

/**
 * Check if the MCP socket server is available (GUI is running).
 */
export function isSocketAvailable(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' && !fs.existsSync(socketPath)) {
      resolve(false)
      return
    }

    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 1000)

    socket.connect(socketPath, () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(true)
    })

    socket.on('error', () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve(false)
    })
  })
}

/**
 * Run as a dumb byte proxy: stdin → socket, socket → stdout.
 * No JSON parsing — pure relay.
 */
export function runProxy(socketPath: string): void {
  const socket = net.createConnection(socketPath)

  socket.on('connect', () => {
    process.stdin.pipe(socket)
    socket.pipe(process.stdout)
  })

  socket.on('error', (err) => {
    process.stderr.write(`[vibegrid-mcp] socket error: ${err.message}\n`)
    process.exit(1)
  })

  socket.on('close', () => {
    process.exit(0)
  })

  process.stdin.on('end', () => {
    socket.end()
  })
}
