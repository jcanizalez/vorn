// Strip ANSI escape sequences so stored output is plain text.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-2B]|\x1b[=>]/g

export function stripAnsi(data: string): string {
  return data.replace(ANSI_RE, '').replace(/\r/g, '')
}
