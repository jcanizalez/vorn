import pino from 'pino'

// Write to stderr (fd 2) so the main process can capture via electron-log.
// Previously production used the default (stdout), but nothing reads stdout
// after the initial port banner — so all server logs were silently dropped.
//
// Uses pino.destination() instead of transport workers — the server is bundled
// via tsup so transport targets like 'pino/file' can't resolve at runtime.
const log = pino({ level: process.env.VITEST ? 'silent' : 'info' }, pino.destination(2))

export default log
