// /chat-hub-core:version: which chat-hub-core this project runs, and whether a newer one is out.
// Installed: this project's entry in Claude's installed_plugins.json (else this code's own
// version). Newest: the highest v* tag on the marketplace copy's origin (git ls-remote, a few
// seconds at most), else the marketplace copy's own version. The prompt hook runs it outside the
// chat's sandbox; by hand: node version.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isMain, pluginVersion } from './config.mjs'

const HOME = process.env.HOME || ''
export const MARKETPLACE = process.env.CHAT_HUB_MARKETPLACE || `${HOME}/.claude/plugins/marketplaces/chat-hub`
const UPDATE = 'sh ~/.claude/plugins/marketplaces/chat-hub/scripts/update-all.sh'
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const parts = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
export function newer(a, b) {   // true when version a is above b
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
  return false
}

// This project's installed version: the entry for its main checkout, else the user-scope one.
function installed(cwd) {
  try {
    const f = process.env.CHAT_HUB_PLUGINS_FILE || `${HOME}/.claude/plugins/installed_plugins.json`
    const list = (d => (d.plugins || d)['chat-hub-core@chat-hub'])(JSON.parse(readFileSync(f, 'utf8')))
    let root = null
    try { root = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd).replace(/\/\.git$/, '') } catch {}
    const e = (list || []).find(x => x && root && x.projectPath === root) || (list || []).find(x => x && x.scope === 'user')
    if (e?.version) return { version: e.version, where: e.projectPath ? 'this project' : 'your user settings' }
  } catch {}
  return { version: pluginVersion(), where: '' }
}

// The newest release: highest v* tag on origin, else the marketplace copy's version.
function newest() {
  try {
    const tags = git(['ls-remote', '--tags', '--refs', 'origin', 'v*'], MARKETPLACE)
      .split('\n').map(l => l.split('refs/tags/')[1]).filter(t => /^v\d+(\.\d+)*$/.test(t || ''))
    if (tags.length) return { version: tags.reduce((a, b) => newer(b, a) ? b : a).slice(1), from: 'newest tag on GitHub' }
  } catch {}
  const v = pluginVersion(MARKETPLACE)
  return /^\d/.test(v) ? { version: v, from: 'marketplace copy; GitHub not reached' } : null
}

export function versionCommand(cwd = process.cwd()) {
  const have = installed(cwd), top = newest()
  let text = `This project runs chat-hub-core ${have.version}.`
  const loaded = process.env.CHAT_HUB_LOADED_ROOT
  if (loaded && pluginVersion(loaded) !== have.version) text += ` This chat started on ${pluginVersion(loaded)}.`
  if (!top) text += ` Couldn't find the newest version (no marketplace copy at ${MARKETPLACE}).`
  else if (newer(top.version, have.version)) text += ` Newer: ${top.version} is out (${top.from}). To update every project, run: ${UPDATE}`
  else text += ` That's the newest (${top.from}).`
  return { ok: true, text }
}

if (isMain(import.meta.url)) console.log(versionCommand().text)
