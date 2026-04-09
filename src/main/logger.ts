import log from 'electron-log/main'

// Configure electron-log for production use
// Logs are written to:
//   macOS: ~/Library/Logs/vorn/main.log
//   Linux: ~/.config/vorn/logs/main.log
//   Windows: %USERPROFILE%\AppData\Roaming\vorn\logs\main.log

log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB per file
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.format = '[{level}] {text}'

// In production, only log info and above to console
if (process.env.NODE_ENV === 'production') {
  log.transports.console.level = 'info'
}

export default log
