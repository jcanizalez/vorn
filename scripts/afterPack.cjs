/**
 * electron-builder afterPack hook
 *
 * Patches node-pty's unixTerminal.js in the unpacked node_modules to fix a
 * double-replacement bug with the spawn-helper path.
 *
 * node-pty does: helperPath.replace('app.asar', 'app.asar.unpacked')
 * But our Module._load patch already loads node-pty from app.asar.unpacked,
 * so __dirname already contains 'app.asar.unpacked'. The naive replace turns
 * 'app.asar.unpacked' into 'app.asar.unpacked.unpacked' (ENOENT).
 *
 * Fix: replace the naive string replace with a regex that only matches
 * 'app.asar' when NOT already followed by '.unpacked'.
 */
const path = require('path')
const fs = require('fs')

module.exports = async function afterPack(context) {
  const unpackedNodeModules = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents/Resources/app.asar.unpacked/node_modules'
  )

  const unixTerminalPath = path.join(unpackedNodeModules, 'node-pty/lib/unixTerminal.js')

  if (!fs.existsSync(unixTerminalPath)) {
    console.log('[afterPack] node-pty/lib/unixTerminal.js not found, skipping patch')
    return
  }

  let content = fs.readFileSync(unixTerminalPath, 'utf8')

  // Replace the naive string replace with a regex-based one that uses a
  // negative lookahead to avoid matching 'app.asar.unpacked'
  const oldLine = "helperPath = helperPath.replace('app.asar', 'app.asar.unpacked');"
  const newLine = "helperPath = helperPath.replace(/app\\.asar(?!\\.unpacked)/g, 'app.asar.unpacked');"

  if (content.includes(oldLine)) {
    content = content.replace(oldLine, newLine)
    fs.writeFileSync(unixTerminalPath, content)
    console.log('[afterPack] Patched node-pty unixTerminal.js spawn-helper path fix')
  } else if (content.includes('app.asar.unpacked.unpacked')) {
    console.warn('[afterPack] WARNING: unixTerminal.js already has double-unpacked issue')
  } else {
    console.log('[afterPack] node-pty unixTerminal.js already patched or uses different pattern')
  }
}
