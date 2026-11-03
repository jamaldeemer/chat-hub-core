// Shared helpers for chat-hub-core's hooks.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// shown: a line the app shows the owner itself (systemMessage), apart from what the model gets.
export function say(event, text, shown) {
  process.stdout.write(JSON.stringify({ ...(shown && { systemMessage: shown }),
    hookSpecificOutput: { hookEventName: event, additionalContext: text } }))
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
function sharedHubFile(cwd = process.cwd()) {
  try {
    const dir = execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return dir ? `${dir}/chat-hub/hub` : null
  } catch { return null }
}

// The commit OK, read from a chat's transcript: true when the owner picked a menu answer
// (AskUserQuestion) that starts "Yes" and is about committing (the answer or its question says
// "commit"), after the chat's last commit that went through and with no later "no" to a commit
// question. null when there's no transcript.
// Only a menu counts: a typed message can come from another chat.
const committed = cmd => /(^|[;&|(]\s*)git\s+(?:-C\s+\S+\s+)?commit\b/.test(cmd)
export function menuOk(transcript) {
  if (!transcript || !existsSync(transcript)) return null
  const commits = new Set(), asks = new Set()
  let ok = false
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.includes('tool_')) continue
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (e.isSidechain || !Array.isArray(e.message?.content)) continue
    for (const b of e.message.content) {
      if (b.type === 'tool_use' && b.name === 'Bash' && committed(String(b.input?.command || ''))) commits.add(b.id)
      if (b.type === 'tool_use' && b.name === 'AskUserQuestion') asks.add(b.id)
      if (b.type !== 'tool_result' || b.is_error) continue
      if (commits.has(b.tool_use_id)) ok = false
      if (asks.has(b.tool_use_id)) {
        const pairs = Object.entries(e.toolUseResult?.answers || {})
        if (!pairs.length) for (const m of String(JSON.stringify(b.content)).matchAll(/\\"(.*?)\\"=\\"(.*?)\\"/g)) pairs.push([m[1], m[2]])
        for (const [q, a] of pairs) {
          // A later "Not yet" to a commit question takes an earlier yes back.
          for (const v of [].concat(a)) if (/commit/i.test(`${q} ${v}`)) ok = /^yes\b/i.test(String(v).trim())
        }
      }
    }
  }
  return ok
}

// One ID on its own: an app address starts with `local_`, anything else is a session ID.
const fromId = id => (id.startsWith('local_') ? { app: id } : { session: id })

// The hub's own notes (hub-notes.md, next to the hub record), or null without git.
export function hubNotesFile() {
  const f = sharedHubFile()
  return f ? f.replace(/\/hub$/, '/hub-notes.md') : null
}

// A work chat's own notes (chat-hub/work/<branch>.md, next to the hub record): what a cleared
// chat needs back, in a "## Next" section of "- After clear: …" lines. Keyed by branch, which a
// clear keeps. null without git or on no branch (detached HEAD).
export function workNotesFile(dir = process.cwd()) {
  const f = sharedHubFile(dir)
  if (!f) return null
  let branch = ''
  try {
    branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {}
  if (!branch || branch === 'HEAD') return null
  return f.replace(/\/hub$/, `/work/${branch.replace(/[^\w.-]/g, '_')}.md`)
}

// Context limits set with /chat-hub-core:limit (limits.json, next to the hub record). They
// override `trimAt` / `trimAtWork` in the settings for every chat in every worktree, from the
// next prompt on, and are never committed. {} when none are set; null file without git.
export function limitsFile() {
  const f = sharedHubFile()
  return f ? f.replace(/\/hub$/, '/limits.json') : null
}
export function readLimits() {
  const f = limitsFile()
  if (!f || !existsSync(f)) return {}
  try {
    const o = JSON.parse(readFileSync(f, 'utf8'))
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch { return {} }
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

// This chat's own app address (`local_…`). The desktop app gives it to every chat and its hooks,
// and it stays the same across a restart or clear, so the hooks can tell the hub apart
// themselves. Empty outside the desktop app (e.g. the plain terminal).
export const hostApp = () => process.env.CLAUDE_CODE_HOST_SESSION_ID || ''

// Is this chat the hub? By session ID, or (after a clear, before the new session ID is
// recorded) by the app address.
export const isHubChat = (hub, session) =>
  !!((hub.session && session && hub.session === session) || (hub.app && hostApp() === hub.app))

// Lines in the hub notes' "## Next" section that start "After clear:" (also "After the clear:"),
// the work the hub put off while wrapping up. Quoted in the start note so it comes first.
export function afterClearItems(file = hubNotesFile()) {
  if (!file || !existsSync(file)) return []
  const out = []
  let inNext = false
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^## /.test(line)) { inNext = /^## Next\b/i.test(line); continue }
    const m = inNext && line.match(/^[-*\s]*after (?:the )?clear:\s*(.+)$/i)
    if (m) out.push(m[1].trim())
  }
  return out
}

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

// True when the file whose import.meta.url is given was run directly (node file.mjs), not imported.
// Compares real paths: the script may be reached through a symlink (on macOS $TMPDIR is under
// /var, which is /private/var), and a plain string compare would then say no and do nothing.
export function isMain(url, argv1 = process.argv[1]) {
  if (!argv1) return false
  const real = p => { try { return realpathSync(p) } catch { return resolve(p) } }
  return real(fileURLToPath(url)) === real(argv1)
}

// The plugin's own folder (the version this code is from) and the version in its plugin.json.
export const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export function pluginVersion(root = PLUGIN_ROOT) {
  try { return JSON.parse(readFileSync(`${root}/.claude-plugin/plugin.json`, 'utf8')).version || basename(root) }
  catch { return basename(root) }
}

// After a plugin update, the launcher (run.mjs) runs the new version's hooks, but the chat still
// holds the rules it loaded at start. CHAT_HUB_LOADED_ROOT (set by the launcher) is the version
// the chat started with; when it isn't this one, tell the chat once per version to read the new
// rules file, and to restart only if the hooks list (hooks.json) changed. Each chat's last
// notice is kept in git's shared folder (rules/<session>). No git or no launcher: null.
// Returns { text, shown }: text is for the model only; shown is the one line the app shows the
// owner ("Updated"), so the model must not talk about the update itself.
export function rulesNotice({ session, isHub }) {
  try {
    const loaded = process.env.CHAT_HUB_LOADED_ROOT
    const f = sharedHubFile()
    if (!loaded || !session || !f || loaded === PLUGIN_ROOT) return null
    const now = pluginVersion(), dir = f.replace(/\/hub$/, '/rules'), rec = `${dir}/${session.replace(/[^\w.-]/g, '_')}`
    if (pluginVersion(loaded) === now || (existsSync(rec) && readFileSync(rec, 'utf8').trim() === now)) return null
    mkdirSync(dir, { recursive: true })
    writeFileSync(rec, now + '\n')
    const read = p => { try { return readFileSync(p, 'utf8') } catch { return null } }
    const restart = read(`${loaded}/hooks/hooks.json`) !== read(`${PLUGIN_ROOT}/hooks/hooks.json`)
    const skill = isHub ? 'hub' : 'work-chat'
    const shown = restart ? 'Updated: restart this chat' : 'Updated'
    const text = `chat-hub-core was updated to ${now} (this chat started on ${pluginVersion(loaded)}). Before anything else, ` +
      `read ${PLUGIN_ROOT}/skills/${skill}/SKILL.md in full with the Read tool: it replaces the ${skill} rules you loaded ` +
      '(loading the skill again may give the old copy). Then carry on with the prompt. The app already showed the owner ' +
      `"${shown}", so say nothing about the update, the version or the new rules: no line, no summary.` +
      (restart ? ' This update also changes when hooks run, which only takes effect after a restart; the owner was told ' +
        'to restart this chat (terminal: exit, then `claude --continue`; desktop app: quit and reopen the app).' : '')
    return { text, shown }
  } catch { return null }
}

// Hub notes are one current snapshot in fixed sections, not a diary. These are the allowed
// `## ` headings (matched on their first word or two); anything else, or a file over
// notesMaxBytes (default 6000, 0 = off), gets a note telling the hub to rewrite them.
export const NOTES_SECTIONS = ['Me', 'Next', 'Shipped', 'Preview', 'Waiting', 'Open chats', 'Plans', 'Gotchas']
export function notesProblem(cfg, file = hubNotesFile()) {
  if (!file || !existsSync(file)) return ''
  const text = readFileSync(file, 'utf8')
  const max = cfg?.notesMaxBytes ?? 6000
  const bytes = Buffer.byteLength(text)
  const bad = text.split('\n').filter(l => /^## /.test(l)).map(l => l.slice(3).trim())
    .filter(h => !NOTES_SECTIONS.some(s => h.toLowerCase() === s.toLowerCase() || h.toLowerCase().startsWith(s.toLowerCase() + ' ') || h.toLowerCase().startsWith(s.toLowerCase() + ':')) ||
      /\d{4}-\d{2}-\d{2}|\blatest\b|checkpoint|before a clear/i.test(h))
  const why = [
    bad.length ? `headings outside the fixed sections (${bad.slice(0, 3).map(h => `"## ${h.slice(0, 60)}"`).join(', ')}${bad.length > 3 ? `, +${bad.length - 3} more` : ''})` : '',
    max > 0 && bytes > max ? `${bytes} bytes, over the ${max}-byte limit` : '',
  ].filter(Boolean)
  const done = text.split('\n').filter(l => l.includes('✅')).map(l => l.replace(/^[-*\s]+/, '').trim())
  const rewrite = why.length ? `⚠️ Your hub notes (${file}) have ${why.join(' and ')}. Before anything else, rewrite them as ONE current ` +
    `snapshot under only these headings: ${NOTES_SECTIONS.map(s => `"## ${s}"`).join(', ')}. Merge what's still true into ` +
    'those sections, keep only the last 2 shipped releases, drop closed chats and old history (git keeps it), and add no ' +
    'dated, "Latest" or checkpoint blocks.' : ''
  // A ✅ chat in the notes gets listed to the owner again long after they deleted it, so none may stay there.
  const closed = done.length ? `⚠️ Your hub notes (${file}) still list ✅ (closed) chats: ` +
    `${done.slice(0, 3).map(l => `"${l.slice(0, 60)}"`).join(', ')}${done.length > 3 ? `, +${done.length - 3} more` : ''}. ` +
    'If you haven\'t told the owner yet, name them once, in one line, as ready to delete; then delete those lines from the ' +
    'notes now. Never keep ✅ chats (or the ✅ symbol) in the notes, and never list them to the owner again.' : ''
  return [rewrite, closed].filter(Boolean).join(' ')
}

// Level 2: ask CI whether it passed on a commit, with the settings' `ci.passed` command
// (`SHA=<sha> sh -c "<command>"`; prints 1 = passed, 0 = not, anything else = couldn't ask).
// Returns 'passed', 'not' (running, failed or not started: the command can't tell which) or 'unknown'.
export function ciState(cfg, sha, dir = process.cwd(), timeout = 20000) {
  const cmd = cfg?.ci?.passed
  if (!cmd || !sha) return 'unknown'
  let out = '', rc = 0
  try { out = execFileSync('sh', ['-c', cmd], { cwd: dir, encoding: 'utf8', timeout, env: { ...process.env, SHA: sha }, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch (e) { rc = e.status ?? 1; out = String(e.stdout || '').trim() }
  return out === '1' ? 'passed' : out === '0' && rc === 0 ? 'not' : 'unknown'
}

// A branch's push state, as last fetched: { branch, head, remote, ahead }. remote is the upstream,
// or origin/<branch> when there's none (chats can't set one), or '' if never pushed; ahead counts
// commits not pushed. null when not a branch or not in git.
export function pushState(branch, dir = process.cwd()) {
  const git = (...a) => { try { return execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
  if (!branch || branch === 'HEAD') return null
  const head = git('rev-parse', '--verify', '-q', `refs/heads/${branch}`)
  if (!head) return null
  const up = git('rev-parse', '--abbrev-ref', `${branch}@{u}`)
  const remote = up || (git('rev-parse', '--verify', '-q', `refs/remotes/origin/${branch}`) ? `origin/${branch}` : '')
  const ahead = remote ? Number(git('rev-list', '--count', `${remote}..refs/heads/${branch}`) || 0) : 0
  return { branch, head, remote, ahead }
}
