// At the start of every chat: tell Claude which chat-hub-core rules apply here.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { hookInput, hubSession, readConfig, say } from './config.mjs'

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

const c = readConfig()
if (!c) {
  say('SessionStart', "chat-hub-core is installed but this project isn't set up. If the owner asks about chats, hubs or releases, suggest /chat-hub-core:setup.")
} else {
  const guard = c.level >= 1 ? ensureGuard() : ''
  const me = hookInput().session_id || ''
  const hub = hubSession(c)
  let who
  if (hub && me && hub === me) {
    who = 'This chat is the hub: load the chat-hub-core:hub skill now.'
  } else if (hub) {
    who = `This chat is a work chat: load the chat-hub-core:work-chat skill now. This project's hub is session ${hub}; ` +
      'only ever message that session. Become the hub only if the owner runs /chat-hub-core:hub here.'
  } else {
    who = 'No hub is recorded yet. If this chat\'s name ends with "Hub" or "Manager" (ignore any code prefix and case), ' +
      'it is the hub: load the chat-hub-core:hub skill now. Otherwise load chat-hub-core:work-chat. Other projects have ' +
      'hubs with the same names: this project\'s hub is the one whose folder is this project (or one of its worktrees). ' +
      'Check a candidate\'s folder before messaging it, never pick by title alone, and ask the owner if more than one ' +
      'matches or none does.'
  }
  const mine = me ? ` This chat's session ID is ${me}.` : ''
  say('SessionStart', `This project uses chat-hub-core (level ${c.level}). ${who}${mine}${guard}`)
}
