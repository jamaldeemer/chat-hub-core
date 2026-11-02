// The hub's close backstop. A work chat's wrap-up report ("**Wrap-up · C7**") reaches the hub as a
// prompt; the hub must close that chat at once (close-chat.mjs, then ✅), even when its work ships
// in a later release: there is no "parked" state. This remembers each report seen (wrapups.json,
// next to the hub record, never committed) and, on every later hub prompt or start, reads the
// chats' titles from the app's custom-title.json files: a chat that sent its report and still shows
// ⏳ gets a reminder to close it now. A chat whose title moved on (✅, or 🔨 after a failed close)
// is forgotten. Outside the desktop app there are no title files, so only the first note is given.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { hubNotesFile } from './config.mjs'

const WEEK = 7 * 24 * 3600 * 1000
const reportRe = /Wrap-up\s*·\s*([0-9A-Z]{2})\b/gu

// The codes of the wrap-up reports in a prompt.
export const reportCodes = text => [...new Set([...String(text || '').matchAll(reportRe)].map(m => m[1]))]

const stateFile = () => { const f = hubNotesFile(); return f ? f.replace(/\/hub-notes\.md$/, '/wrapups.json') : null }
function readState(f) { try { return JSON.parse(readFileSync(f, 'utf8')) || {} } catch { return {} } }
function writeState(f, s) { try { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(s)) } catch {} }

// Where the app keeps transcripts: the folder above this chat's own transcript's folder.
const projectsDir = transcript =>
  process.env.CHAT_HUB_PROJECTS_DIR || (transcript ? dirname(dirname(transcript)) : join(homedir(), '.claude', 'projects'))
// The app names a folder's transcripts folder after its path, every other character a '-'.
const encode = p => p.replace(/[^a-zA-Z0-9]/g, '-')

// Every chat title in this project's folders (the main one and every worktree).
export function projectTitles(transcript) {
  let trees = []
  try {
    trees = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9))
  } catch { return [] }
  const root = projectsDir(transcript)
  const titles = []
  for (const dir of new Set(trees.map(encode))) {
    let sessions = []
    try { sessions = readdirSync(join(root, dir)) } catch { continue }
    for (const s of sessions) {
      const f = join(root, dir, s, 'custom-title.json')
      if (!existsSync(f)) continue
      try { const t = JSON.parse(readFileSync(f, 'utf8')).customTitle; if (typeof t === 'string') titles.push(t) } catch {}
    }
  }
  return titles
}

const hasCode = (title, code) => new RegExp(`(^|\\s)${code} · `, 'u').test(title)
const howToClose =
  'run close-chat.mjs <its branch> now and, on READY, set ✅ in the same step (on a FAIL, tell the ' +
  'chat what failed). Close it even if its work ships in a later release: the merge into the release preview is ' +
  'what keeps it safe, and a chat never waits at ⏳ for a later release (a later problem is a new chat).'

// The hub's note for this prompt ('' when there's nothing to say). prompt: the text that woke it.
export function closeBackstop({ prompt = '', transcript = '', now = Date.now() } = {}) {
  const f = stateFile()
  const fresh = reportCodes(prompt)
  const state = f ? readState(f) : {}
  for (const c of fresh) state[c] = now
  const titles = Object.keys(state).length ? projectTitles(transcript) : []
  const stale = []
  for (const [code, at] of Object.entries(state)) {
    const mine = titles.filter(t => hasCode(t, code))
    const waiting = mine.filter(t => /^⏳/u.test(t))
    // Moved on (✅, or back to work after a failed close), or gone and old: forget it.
    if ((mine.length && !waiting.length) || (!mine.length && now - at > WEEK)) { delete state[code]; continue }
    if (waiting.length && !fresh.includes(code)) stale.push(`${code} ("${waiting[0]}")`)
  }
  if (f) writeState(f, state)
  const out = []
  if (fresh.length) out.push(
    `chat-hub-core: this message has the wrap-up report of ${fresh.join(', ')}. Close it now: ${howToClose}`)
  if (stale.length) out.push(
    `chat-hub-core close backstop: ${stale.join(', ')} sent its wrap-up report and still shows ⏳. ` +
    `Close it now, before anything else: ${howToClose}`)
  return out.join(' ')
}
