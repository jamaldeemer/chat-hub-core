// Shared helpers for chat-hub-core's hooks.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// The project's settings (.claude/chat-hub.json). Null when setup hasn't run.
export function readConfig(dir = process.cwd()) {
  try {
    return JSON.parse(readFileSync(`${dir}/.claude/chat-hub.json`, 'utf8'))
  } catch {
    return null
  }
}

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
// an app address alone is added to the current record. Returns the hub it replaced, or ''.
export function setHub({ session = '', app = '' }) {
  const old = readHub()
  const next = session ? { session, app } : { session: old.session, app }
  const replaced = session && hubAddress(old) && old.session !== session && !(app && app === old.app) ? hubAddress(old) : ''
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
