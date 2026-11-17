// The hub's bookkeeping, done by hooks so the hub only sees a short line when there's something
// to do. Hooks can't rename or message chats; they say exactly which call the hub makes.
// - Open count: the hub's title ends with how many open chats are tagged for its release (the
//   ʀ<n> in its own title, else `nextRelease`) and not ✅. Counted here from the chats' titles (the app's custom-title.json files); the hub hears
//   only when its own count is wrong, and never lists sessions to recount.
// - Deleted chats: a chat under "## Open chats" in the hub's notes whose session has gone from
//   the app (the owner deleted it) is named, so the hub drops it.
// - Closing: a wrap-up report in the hub's prompt gets the one close-chat.mjs command to run (in
//   the hub's sandbox: a hook never runs it) and what to do on READY or FAIL.
// - CI (level 2): a chat showing 🚀 whose head passed CI is named once per commit.
// Every chat's title is read from <projects>/<folder>/<session>/custom-title.json; the app
// removes that folder when a chat is deleted. Outside the desktop app there are no such files,
// and these checks say nothing.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ciState, hubNotesFile, pushState } from './config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const git = (dir, ...a) => {
  try { return execFileSync('git', ['-C', dir || '.', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return null }
}

// Where the app keeps transcripts: the folder above this chat's own transcript's folder.
export const projectsDir = transcript =>
  process.env.CHAT_HUB_PROJECTS_DIR || (transcript ? dirname(dirname(transcript)) : join(homedir(), '.claude', 'projects'))
// The app names a folder's transcripts folder after its path, every other character a '-'.
const encode = p => p.replace(/[^a-zA-Z0-9]/g, '-')

// The project's folders (the main one and every worktree), with the branch checked out in each.
export function projectTrees(dir = '.') {
  const raw = git(dir, 'worktree', 'list', '--porcelain')
  if (raw === null) return []
  return raw.split('\n\n').map(b => ({
    path: b.match(/^worktree (.*)$/m)?.[1] || '',
    branch: b.match(/^branch refs\/heads\/(.*)$/m)?.[1] || '',
  })).filter(t => t.path)
}

const codeRe = /(?:^|\s)([0-9A-Z]{2}) · /u
// Every titled chat in this project: { session, title, code, at, folder, branch }.
export function projectChats({ transcript = '', dir = '.' } = {}) {
  const root = projectsDir(transcript)
  const chats = []
  const seen = new Set()
  for (const t of projectTrees(dir)) {
    const enc = encode(t.path)
    if (seen.has(enc)) continue
    seen.add(enc)
    let sessions = []
    try { sessions = readdirSync(join(root, enc)) } catch { continue }
    for (const s of sessions) {
      const f = join(root, enc, s, 'custom-title.json')
      if (!existsSync(f)) continue
      try {
        const title = JSON.parse(readFileSync(f, 'utf8')).customTitle
        if (typeof title !== 'string') continue
        chats.push({ session: s, title, code: title.match(codeRe)?.[1] || '', at: statSync(f).mtimeMs, folder: t.path, branch: t.branch })
      } catch {}
    }
  }
  return chats
}

// One chat per code: the newest title. A clear or restart can leave the same chat's older title
// behind under its old session ID; an older chat with a reused code is long deleted.
export function openChats(chats, hubSession = '') {
  const by = new Map()
  for (const c of chats) {
    if (!c.code || c.session === hubSession) continue
    const was = by.get(c.code)
    if (!was || c.at > was.at) by.set(c.code, c)
  }
  return [...by.values()]
}

// Tagged for release n: release-first "ʀ38 ", "ʀ07~", code-first "(ʀ38)"; an old plain R too.
export const taggedFor = (title, n) => new RegExp(`(^|[\\s(])[ʀR]0*${Number(n)}[~+]?(?=[\\s)])`, 'u').test(title)
const isDone = title => /^✅/u.test(title)

// How many open chats count toward the hub's title.
export const openCount = (chats, n, except = []) =>
  chats.filter(c => taggedFor(c.title, n) && !isDone(c.title) && !except.includes(c.code)).length

// The hub's title with its count set to n ('' when it can't tell where the count goes).
export function titleWithCount(title, n) {
  if (!title) return ''
  if (/\(\d+\)\s*$/u.test(title)) return title.replace(/\(\d+\)\s*$/u, `(${n})`)
  return `${title.trimEnd()} (${n})`
}

// The note on the hub's own open count ('' when it's right, or nothing can be told).
export function countNote({ cfg, session, transcript = '', dir = '.', chats, except = [] }) {
  if (!cfg || cfg.releases === 'none') return ''
  chats = chats || projectChats({ transcript, dir })
  const own = chats.find(c => c.session === session)?.title
  if (!own) return ''
  // The release the count is for: the one in the hub's own title (the settings' nextRelease can
  // lag behind it), else nextRelease.
  const rel = Number(own.match(/[ʀR]0*(\d+)[~+]?(?=[\s(]|$)/u)?.[1] ?? cfg.nextRelease)
  if (!Number.isFinite(rel) || rel <= 0) return ''
  const n = openCount(openChats(chats, session), rel, except)
  const m = own.match(/\((\d+)\)\s*$/u)
  if (m && Number(m[1]) === n) return ''
  const want = titleWithCount(own, n)
  return `chat-hub-core open count: ${n} open chat(s) are tagged for ʀ${rel} and not ✅, ` +
    `so set your own title to "${want}" (set_session_title with "self"), with your other title calls if you have any.`
}

// Chats under "## Open chats" in the hub's notes whose session the app no longer has. A line names
// its chat by session ID or by app address (`local_…`); an app address is looked up in
// chat-hub/apps/ (the last session ID each one had, kept by every hook), and skipped if unknown.
const idRe = /(?<![\w-])(?:local_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
export function deletedNote({ cfg, transcript = '', dir = '.', notes = hubNotesFile() }) {
  if (!notes || !existsSync(notes)) return ''
  const text = readFileSync(notes, 'utf8')
  const sec = text.match(/^## Open chats\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] || ''
  if (!sec.trim()) return ''
  const root = projectsDir(transcript)
  const dirs = projectTrees(dir).map(t => join(root, encode(t.path)))
  if (!dirs.some(d => existsSync(d))) return ''   // no app transcripts here: can't tell
  const apps = notes.replace(/\/hub-notes\.md$/, '/apps')
  const sessionOf = id => {
    if (!id.startsWith('local_')) return id
    try { return readFileSync(join(apps, id.replace(/[^\w.-]/g, '_')), 'utf8').trim() || null } catch { return null }
  }
  // true: the app still has it; null: can't tell (an app address never seen by a hook).
  const there = id => { const s = sessionOf(id); return s === null ? null : dirs.some(d => existsSync(join(d, s)) || existsSync(join(d, `${s}.jsonl`))) }
  const main = cfg?.branches?.main || 'main', release = cfg?.branches?.release || 'release'
  const gone = []
  for (const line of sec.split('\n')) {
    const ids = line.match(idRe) || []
    if (!ids.length || ids.some(id => there(id) !== false)) continue
    const code = line.match(/\b([0-9][ACEF]|[ACEF][0-9])\b/)?.[1] || ids[0].slice(0, 14)
    const branch = [...line.matchAll(/`([^`\s]+)`|\bbranch\s+([^\s,;`]+)/g)].map(m => m[1] || m[2]).find(b => git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${b}`))
    const safe = branch && [main, release].some(r => git(dir, 'merge-base', '--is-ancestor', `refs/heads/${branch}`, `refs/heads/${r}`) !== null)
    gone.push(`${code}${branch && !safe ? ` (its branch ${branch} isn't on ${main} or ${release}: tell the owner once)` : ''}`)
  }
  if (!gone.length) return ''
  return `chat-hub-core deleted chats: ${gone.join(', ')} under "## Open chats" in your notes ` +
    `${gone.length > 1 ? 'are' : 'is'} gone from the app (the owner deleted ${gone.length > 1 ? 'them' : 'it'}): drop ` +
    `${gone.length > 1 ? 'those lines' : 'that line'}.`
}

// --- Auto-close ------------------------------------------------------------------------------

// Each report's code, branch and Open line, from the prompt.
export function reports(text) {
  const parts = String(text || '').split(/(?=Wrap-up\s*·\s*[0-9A-Z]{2}\b)/u)
  const out = []
  for (const p of parts) {
    const code = p.match(/^Wrap-up\s*·\s*([0-9A-Z]{2})\b/u)?.[1]
    if (!code || out.some(r => r.code === code)) continue
    const commit = p.match(/\*\*Commit:\*\*([^\n]*)/u)?.[1] || ''
    const branch = commit.match(/\bon\s+`([^`\s]+)`/u)?.[1] || ''
    const open = (p.match(/\*\*Open:\*\*([^\n]*)/u)?.[1] || '').trim()
    out.push({ code, branch, open })
  }
  return out
}

const readJson = f => { try { return JSON.parse(readFileSync(f, 'utf8')) || {} } catch { return {} } }
const writeJson = (f, s) => { try { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(s)) } catch {} }

const nothingOpen = open => !open || /^(nothing|none|-|n\/a)\b/i.test(open.replace(/[*_`"]/g, '').trim())
const safeRef = b => /^[\w][\w./-]*$/.test(b) && !b.includes('..')

// The hub's lines for the reports in this prompt: { text, handled } (text '' when there are none).
// It never runs close-chat.mjs itself: hooks run outside the sandbox, and close-chat runs the
// settings' `checks` (which a chat can edit) on the chat's code. It names the one command for the
// hub to run in its sandbox, and what to do on READY or FAIL. A report with no branch (level 0,
// or cut short) gets the close backstop's note instead.
export function closeNote({ prompt, cfg, session, transcript = '', dir = '.' }) {
  const list = reports(prompt).filter(r => r.branch && safeRef(r.branch))
  if (!list.length || (cfg?.level || 0) < 1) return { text: '', handled: [] }
  const chats = projectChats({ transcript, dir })
  const lines = list.map(r => {
    const open = nothingOpen(r.open) ? '' :
      ` Its report's Open line says "${r.open.slice(0, 160)}": if that waits on the owner, or isn't in the followups file, hold the ✅ and sort it out first.`
    const count = countNote({ cfg, session, chats, except: [r.code] }).match(/set your own title to (".*?")/u)?.[1]
    return `${r.code}: run \`node "${join(here, 'close-chat.mjs')}" ${r.branch}\` now (once; don't merge, test or look up its folder first). ` +
      `On READY: set ✅ at the start of its title (keep the rest)${count ? ` and your own title to ${count}` : ''} in one batch, ` +
      `tell the owner once it can be deleted, drop it from your notes, then offer to ship (Releases).${open} ` +
      "On FAIL: tell the chat what failed (a merge clash is the chat's to resolve, not yours)."
  })
  return { text: `chat-hub-core close: this message has a wrap-up report. ${lines.join(' ')}`, handled: list.map(r => r.code) }
}

// --- CI (level 2) ----------------------------------------------------------------------------

const ciFile = () => { const f = hubNotesFile(); return f ? f.replace(/\/hub-notes\.md$/, '/ci-told.json') : null }

// Chats showing 🚀 with their branch head's CI state: [{ code, title, branch, sha, ci }].
export function rocketChats({ cfg, session = '', transcript = '', dir = '.', chats } = {}) {
  chats = openChats(chats || projectChats({ transcript, dir }), session)
  const out = []
  for (const c of chats) {
    if (!/^🚀/u.test(c.title) || !c.branch) continue
    const p = pushState(c.branch, dir)
    if (!p) continue
    const ci = p.remote && !p.ahead ? ciState(cfg, p.head, dir) : 'unpushed'
    out.push({ code: c.code, title: c.title, branch: c.branch, sha: p.head.slice(0, 7), ci })
  }
  return out
}

// 🚀 chats whose head passed and that the hub hasn't been told of for that commit; marks them told.
export function newlyPassed(rockets) {
  const f = ciFile()
  const told = f ? readJson(f) : {}
  const fresh = rockets.filter(r => r.ci === 'passed' && told[r.branch] !== r.sha)
  for (const r of fresh) told[r.branch] = r.sha
  if (f && fresh.length) writeJson(f, told)
  return fresh
}

export const passedLine = fresh => fresh.length
  ? `chat-hub-core CI: ${fresh.map(r => `${r.code} passed on ${r.sha}`).join(', ')}. Message ${fresh.length > 1 ? 'each' : 'it'}: ` +
    `"CI passed on <sha>: set 🟢 and ask the owner more or wrap up." (its own watcher may have stopped in a clear).`
  : ''

// ci.passed from the settings committed on the main branch, not the folder's copy, which a chat
// can edit: hooks run it outside the sandbox. '' when main has none.
export function committedCi(cfg, dir = '.') {
  const main = cfg?.branches?.main || 'main'
  if (!safeRef(main)) return ''
  try { return JSON.parse(git(dir, 'show', `refs/heads/${main}:.claude/chat-hub.json`) || '{}')?.ci?.passed || '' } catch { return '' }
}

// The prompt hook's CI line ('' when nothing changed).
export function ciNote({ cfg, session, transcript = '', dir = '.' }) {
  if ((cfg?.level || 0) < 2) return ''
  const passed = committedCi(cfg, dir)
  if (!passed) return ''
  return passedLine(newlyPassed(rocketChats({ cfg: { ...cfg, ci: { ...cfg.ci, passed } }, session, transcript, dir })))
}
