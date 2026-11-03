// At the start of every chat: tell Claude which chat-hub-core rules apply here, and show the owner
// the same usage line the after-turn hook shows (version, and the real numbers after a resume).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { statsLine, updateUsage } from './usage.mjs'
import { withPace } from './pace.mjs'
import { applyDefaults, defaultsNote, offNote } from './tools.mjs'
import { closeBackstop } from './wrapups.mjs'
import { afterClearItems, ciState, hookInput, hostApp, hubAddress, hubNotesFile, loadConfig, notesProblem, pluginVersion, pushState, readHub, say, setHub, workNotesFile } from './config.mjs'

const setHubCmd = `node "${dirname(fileURLToPath(import.meta.url))}/set-hub.mjs"`

// Level 1+: make git use the project's push guard. core.hooksPath lives in .git/config,
// which isn't committed, so each clone needs it once. Hooks run outside the chat's sandbox,
// so we set it here. We never override a hooks folder the project chose itself.
function ensureGuard() {
  if (!existsSync('.githooks/pre-push')) return ''
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let dir = ''
  try { dir = git('config', 'core.hooksPath') } catch {}
  if (dir) return existsSync(`${dir}/pre-push`) ? '' : ` The push guard is off: git uses hooks from "${dir}", which has no pre-push. Tell the owner once.`
  try { git('config', 'core.hooksPath', '.githooks'); return ' (Push guard switched on for this checkout.)' }
  catch { return ' The push guard is off in this checkout: tell the owner once to run `git config core.hooksPath .githooks`.' }
}

// Level 2, a work chat whose branch head is pushed: a clear or restart killed the CI watcher it ran
// in the background, so it would sit at 🚀 until a message came. Ask CI here and tell it what to do.
function ciNote(c) {
  if (c.level < 2) return ''
  let branch = ''
  try { branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch {}
  if ([c.branches?.main || 'main', c.branches?.release || 'release'].includes(branch)) return ''
  const p = pushState(branch)
  if (!p || !p.remote || p.ahead) return ''
  const sha = p.head.slice(0, 7)
  const lost = 'A clear or restart stopped any CI watcher you had.'
  const ask = 'ask the owner "Anything more, or should I wrap up?" (menu)'
  const ci = ciState(c, p.head)
  if (ci === 'passed') return ` CI passed on your pushed branch head ${sha}. If your title still shows 🚀, set 🟢 now and ${ask}.`
  return ` Your branch head ${sha} is pushed and CI ${ci === 'not' ? "hasn't passed on it yet" : "couldn't be asked about it (ci.passed failed)"}. ` +
    `${lost} If your title shows 🚀, look at the run for ${sha} now: still running, start the watcher again in the background; ` +
    `failed, set 🔴 and fix it; passed, set 🟢 and ${ask}. Never wait for the owner to prompt you about it.`
}

// A work chat after a clear: what it wrote under "## Next" in its own notes before the clear
// (owner requests not finished, open questions, where it stands). Without this a cleared work
// chat starts from its brief alone and loses a request the owner made during wrap-up.
function workNote() {
  const f = workNotesFile()
  const later = afterClearItems(f)
  if (!later.length) return ''
  return ` Before a clear you wrote down in your chat notes (${f}) what to pick up again: read that file first, then ` +
    'do these before anything new. A question to the owner on the list: ask it again now. A request: carry it out ' +
    "(or, if it needs the owner's go, ask). Delete each line from the notes once it's done or answered: " +
    later.map(l => `"${l.slice(0, 300)}"`).join('; ') + '.'
}

const { cfg: c, error } = loadConfig()
if (error) {
  say('SessionStart', `chat-hub-core: this project's settings file (.claude/chat-hub.json) is broken (${error}). ` +
    'Tell the owner first thing, before anything else, and follow none of the chat-hub-core rules until it is fixed ' +
    '(running /chat-hub-core:setup again rewrites it).')
} else if (!c) {
  say('SessionStart', "chat-hub-core is installed but this project isn't set up. If the owner asks about chats, hubs or releases, suggest /chat-hub-core:setup.")
} else {
  const guard = c.level >= 1 ? ensureGuard() : ''
  const input = hookInput()
  const me = input.session_id || ''
  const hub = readHub(c)
  const to = hubAddress(hub)
  const notesFile = hubNotesFile()
  const later = afterClearItems(notesFile)
  const notes = notesFile && existsSync(notesFile) ? ` Your notes exist: read ${notesFile} before anything else.` +
    ((p => p ? ' ' + p : '')(notesProblem(c, notesFile))) +
    (later.length ? ` Your notes' "## Next" has work you put off until after the clear; do it first, before anything new, ` +
      `then delete each line from the notes: ${later.map(l => `"${l.slice(0, 120)}"`).join('; ')}.` : '') : ''
  // Owner-deleted chats send the hub no event: recount and prune on start.
  const recount =
    " Then list sessions (include archived): drop chats the owner deleted from your notes and fix your title's open count if it's wrong." +
    ((b => b ? ' ' + b : '')(closeBackstop({ transcript: input.transcript_path })))
  const app = hostApp()
  let who
  if (hub.app && app && app === hub.app) {
    // The app says this chat is the hub (restarted or cleared): re-record its new session ID here,
    // so it needn't look itself up, and so the other hooks know it at once.
    let rec = ''
    if (me && hub.session !== me) {
      try { setHub({ session: me, app: hub.app }) } catch (e) { rec = ` (Couldn't re-record your session ID: ${e.message}; run ${setHubCmd} --session ${me} --app ${hub.app}.)` }
    }
    who = `This chat is the hub (the app gives this chat the hub's address, ${hub.app}): load the chat-hub-core:hub skill now; ` +
      `never the work-chat skill.${rec}` + notes + recount
  } else if (hub.app && app) {
    who = `This chat is a work chat (its app address is ${app}; the hub is ${hub.app}): load the chat-hub-core:work-chat ` +
      `skill now and only ever message ${hub.app}.` + ciNote(c) + workNote()
  } else if (hub.session && me && hub.session === me) {
    // In the desktop app, record the hub's app address here too when it's missing.
    let added = false
    if (!hub.app && app) { try { setHub({ app }); added = true } catch {} }
    who = 'This chat is the hub: load the chat-hub-core:hub skill now.' + notes + recount +
      (hub.app || added ? '' : ` Work chats can't message you yet: look up this session's own details with your session tools (its id starts with local_) and run ${setHubCmd} --app <that id>.`)
  } else if (hub.app) {
    who = `This project's hub is app session ${hub.app}. Look up this session's own details with your session tools: ` +
      `if its id is ${hub.app}, this chat is the hub (it was restarted or cleared): load the chat-hub-core:hub skill now and ` +
      `run ${setHubCmd} --session <this chat's session ID, below> --app ${hub.app}.${notes ? ' Then' + notes.replace(' Your notes exist:', ' (your notes exist)') : ''}${recount} Otherwise this is a work chat: ` +
      `load the chat-hub-core:work-chat skill now and only ever message ${hub.app}.` + ciNote(c) + workNote()
  } else if (hub.session) {
    who = `This chat is a work chat: load the chat-hub-core:work-chat skill now. This project's hub is session ${hub.session}; ` +
      'only ever message that session (if the app won\'t accept that ID, ask the owner which chat is the hub). ' +
      'Become the hub only if the owner runs /chat-hub-core:hub here.' + ciNote(c) + workNote()
  } else {
    who = 'No hub is recorded for this project. Load the chat-hub-core:work-chat skill, and tell the owner first thing: ' +
      '"No hub is recorded; type /chat-hub-core:hub in the chat that should be the hub." Until one is recorded, ' +
      'don\'t message any chat as the hub and don\'t guess one by its name.' + workNote()
  }
  const mine = me ? ` This chat's session ID is ${me}.` : ''
  // What's off for this chat (read before the defaults change it: this chat keeps its tools).
  const off = [offNote(), defaultsNote(applyDefaults())].filter(Boolean).map(t => ' ' + t).join('')
  // The owner's usage line: a new or cleared chat has no turns yet, so it shows the version.
  const stats = c.stats === false || !me ? '' :
    withPace(statsLine(updateUsage(me, input.transcript_path), { compacted: input.source === 'compact' }), c)
  say('SessionStart', `This project uses chat-hub-core ${pluginVersion()} (level ${c.level}). ${who}${mine}${guard}${off}`, stats)
}
