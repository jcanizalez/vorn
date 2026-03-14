import { defineConfig } from 'tsup'

const NATIVE_MODULE_PATCH = `
// Patch module resolution for Electron's utilityProcess.
//
// utilityProcess doesn't have the main process's ASAR require() patching,
// so bare require('node-pty') fails. Electron wraps Module._resolveFilename
// with its own n._resolveFilename, making Module-level patches unreliable.
//
// Solution: intercept Module._load (the function that actually calls require)
// before Electron can interfere, and redirect native module names to their
// absolute paths in app.asar.unpacked/node_modules/.
//
// The parent process passes VIBEGRID_NATIVE_MODULES_PATH as an env var
// pointing to the unpacked node_modules directory.
//
// Additionally, better-sqlite3 uses require('bindings') to locate its
// .node addon. Since 'bindings' is a JS package trapped inside the asar
// archive (inaccessible to utilityProcess), we intercept it and return a
// shim that resolves directly to the known .node file path.
//
// @see https://electron-vite.org/guide/assets
// @see https://github.com/electron/electron/issues/8727
;(function() {
  var nativePath = process.env.VIBEGRID_NATIVE_MODULES_PATH;
  if (!nativePath) return;
  try {
    var Module = require('module');
    var path = require('path');
    var nativeModules = { 'node-pty': true, 'better-sqlite3': true };

    // Map of known native addon .node files for the bindings shim
    var knownAddons = {
      'better_sqlite3.node': path.join(nativePath, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
    };

    var origLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      // Redirect native module requires to unpacked path
      if (nativeModules[request]) {
        return origLoad.call(this, path.join(nativePath, request), parent, isMain);
      }
      // Shim the 'bindings' package — return a function that resolves
      // addon names from our known unpacked paths
      if (request === 'bindings') {
        return function(opts) {
          // bindings accepts a string or { bindings: 'name.node', ... }
          var name = typeof opts === 'object' ? opts.bindings : opts;
          if (knownAddons[name]) {
            return origLoad.call(Module, knownAddons[name], parent, false);
          }
          // Fallback: try original bindings module
          return origLoad.call(Module, 'bindings', parent, isMain)(opts);
        };
      }
      return origLoad.call(this, request, parent, isMain);
    };
  } catch(e) { console.error('[native-module-patch] failed:', e); }
})();
`

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  clean: true,
  banner: {
    js: NATIVE_MODULE_PATCH
  },
  // Bundle ALL JS dependencies so the server runs standalone in Electron's
  // utilityProcess (which cannot access modules inside the asar archive).
  //
  // Native modules (node-pty, better-sqlite3) remain external because they
  // contain compiled .node binaries loaded at runtime from disk.
  noExternal: [/^(?!node-pty$|better-sqlite3$)/],
  external: ['node-pty', 'better-sqlite3']
})
