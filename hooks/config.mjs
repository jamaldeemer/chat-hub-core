// Shared helpers for chat-hub-core's hooks.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// The project's settings (.claude/chat-hub.json): { cfg, error }. cfg is null when setup
// hasn't run (error null) or when the file is broken (error says why).
export function loadConfig(dir = process.cwd()) {
  const f = `${dir}/.claude/chat-hub.json`
  if (!existsSync(f)) return { cfg: null, error: null }
  try {
    const cfg = JSON.parse(readFileSync(f, 'utf8'))
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return { cfg: null, error: 'it is not a JSON object' }
    return { cfg, error: null }
  } catch (e) { return { cfg: null, error: e.message } }
}
export const readConfig = (dir = process.cwd()) => loadConfig(dir).cfg

export function say(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }))
}

// What Claude Code passes on stdin (session_id, prompt, ...). Empty object when there's none.
export function hookInput() {
  if (process.stdin.isTTY) return {}
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}') } catch { return {} }
}

// The hub is kept in git's shared folder (the .git every worktree points to), so every chat
// sees it at once and it's never committed. It's stored by two IDs: Claude's session ID (what
// hooks see) and the desktop app's address, `local_…` (what the app's messaging uses, and
// what survives a clear). Without git, it falls back to `hubSession` in the settings.
function sharedHubFile() {
  try {
    const dir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return dir ? `${dir}/chat-hub/hub` : null
  } catch { return null }
}

// One ID on its own: an app address starts with `local_`, anything else is a session ID.
const fromId = id => (id.startsWith('local_') ? { app: id } : { session: id })

// The hub's own notes (hub-notes.md, next to the hub record), or null without git.
export function hubNotesFile() {
  const f = sharedHubFile()
  return f ? f.replace(/\/hub$/, '/hub-notes.md') : null
}

export function readHub(cfg = readConfig()) {
  const f = sharedHubFile()
  if (f && existsSync(f)) {
    const raw = readFileSync(f, 'utf8').trim()
    if (raw) {
      try { const h = JSON.parse(raw); if (h && (h.session || h.app)) return { session: h.session || '', app: h.app || '' } }
      catch { return { session: '', app: '', ...fromId(raw) } }   // older plain-text file
    }
  }
  return cfg?.hubSession ? { session: '', app: '', ...fromId(cfg.hubSession) } : { session: '', app: '' }
}

// The ID to tell other chats to message: the app address when known.
export const hubAddress = h => h.app || h.session

// Record the hub. A new session replaces the record (keeping the app address only if given);
// an app address alone is added to the current record. Taking over from a different hub
// (another session, and not the same app address) is refused unless `replace` is set, so a
// second chat can't silently become the hub. Returns the hub it replaced, or ''.
export class HubTaken extends Error {}
export function setHub({ session = '', app = '', replace = false }) {
  const old = readHub()
  const next = session ? { session, app } : { session: old.session, app }
  const replaced = session && hubAddress(old) && old.session !== session && !(app && app === old.app) ? hubAddress(old) : ''
  if (replaced && !replace) {
    throw new HubTaken(`${replaced}${old.app && old.session ? ` (session ${old.session})` : ''} is already recorded as this project's hub`)
  }
  const f = sharedHubFile()
  if (f) {
    mkdirSync(f.replace(/\/hub$/, ''), { recursive: true })
    writeFileSync(f, JSON.stringify(next) + '\n')
  } else {
    const cfg = readConfig() || {}
    writeFileSync('.claude/chat-hub.json', JSON.stringify({ ...cfg, hubSession: next.app || next.session }, null, 2) + '\n')
  }
  return replaced
}
