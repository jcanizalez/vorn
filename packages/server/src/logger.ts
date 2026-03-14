import pino from 'pino'

const log = pino({
  level: process.env.VITEST ? 'silent' : 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino/file', options: { destination: 2 } } // stderr in dev
      : undefined
})

export default log
