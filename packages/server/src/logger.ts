import pino from 'pino'

// Write to stderr so the main process can capture via electron-log.
// Uses process.stderr directly — pino.destination(2) uses SonicBoom which
// crashes in Electron's utilityProcess, and transport workers can't resolve
// targets like 'pino/file' in the tsup bundle.
const log = pino({ level: process.env.VITEST ? 'silent' : 'info' }, process.stderr)

export default log
