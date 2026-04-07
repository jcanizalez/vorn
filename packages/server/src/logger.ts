import pino from 'pino'

const log = pino({
  level: process.env.VITEST ? 'silent' : 'info',
  // Always write to stderr so the main process can capture via electron-log.
  // Previously production used the default (stdout), but nothing reads stdout
  // after the initial port banner — so all server logs were silently dropped.
  transport: { target: 'pino/file', options: { destination: 2 } }
})

export default log
