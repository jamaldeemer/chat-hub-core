// The launcher: hooks.json runs every hook as `node run.mjs <hook>`. It runs that hook from the
// chat-hub-core version this project has installed now, not the one the chat started with, so
// an update reaches open chats without a restart. If that version can't be found or lacks the
// hook, or this chat runs a copy from somewhere else (claude --plugin-dir), it runs its own
// copy. Keep this file small and stable: chats started on this version keep running it.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const own = dirname(dirname(fileURLToPath(import.meta.url)))   // the version this chat started with
const name = process.argv[2] || ''
if (!/^[a-z-]+$/.test(name)) process.exit(0)
process.argv.splice(2, 1)

// This project's install of chat-hub-core (Claude's installed_plugins.json, read only).
function installedRoot() {
  try {
    const f = process.env.CHAT_HUB_PLUGINS_FILE || `${process.env.HOME}/.claude/plugins/installed_plugins.json`
    const list = (d => (d.plugins || d)['chat-hub-core@chat-hub'])(JSON.parse(readFileSync(f, 'utf8')))
    if (!Array.isArray(list)) return null
    let root = null
    try {
      root = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().replace(/\/\.git$/, '')
    } catch {}
    const e = list.find(x => x && root && x.projectPath === root) || list.find(x => x && x.scope === 'user')
    return typeof e?.installPath === 'string' ? e.installPath : null
  } catch { return null }
}

const real = p => { try { return realpathSync(p) } catch { return p } }
const want = (p => p && real(p))(installedRoot())
// Only switch between versions installed side by side (…/chat-hub-core/<version>).
const root = want && dirname(want) === dirname(real(own)) && existsSync(join(want, 'hooks', `${name}.mjs`)) ? want : own
const hook = join(root, 'hooks', `${name}.mjs`)
if (!existsSync(hook)) process.exit(0)
process.env.CHAT_HUB_LOADED_ROOT = own   // lets the hook tell the chat its rules are out of date
await import(pathToFileURL(hook).href)
