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

// The hub's session ID is kept in git's shared folder (the .git every worktree points to),
// so every chat sees it at once and it's never committed. Without git, it falls back to
// `hubSession` in the settings.
function sharedHubFile() {
  try {
    const dir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return dir ? `${dir}/chat-hub/hub` : null
  } catch { return null }
}

export function hubSession(cfg) {
  const f = sharedHubFile()
  if (f && existsSync(f)) {
    const id = readFileSync(f, 'utf8').trim()
    if (id) return id
  }
  return cfg?.hubSession || ''
}

// Record `id` as the hub. Returns the session it replaced ('' if none).
export function setHub(id) {
  const old = hubSession(readConfig())
  const f = sharedHubFile()
  if (f) {
    mkdirSync(f.replace(/\/hub$/, ''), { recursive: true })
    writeFileSync(f, id + '\n')
  } else {
    const p = '.claude/chat-hub.json'
    const cfg = readConfig() || {}
    writeFileSync(p, JSON.stringify({ ...cfg, hubSession: id }, null, 2) + '\n')
  }
  return old === id ? '' : old
}
