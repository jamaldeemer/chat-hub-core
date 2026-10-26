// At the start of every chat: tell Claude which chat-hub-core rules apply here.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { hookInput, hubAddress, loadConfig, readHub, say } from './config.mjs'

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

const { cfg: c, error } = loadConfig()
if (error) {
  say('SessionStart', `chat-hub-core: this project's settings file (.claude/chat-hub.json) is broken (${error}). ` +
    'Tell the owner first thing, before anything else, and follow none of the chat-hub-core rules until it is fixed ' +
    '(running /chat-hub-core:setup again rewrites it).')
} else if (!c) {
  say('SessionStart', "chat-hub-core is installed but this project isn't set up. If the owner asks about chats, hubs or releases, suggest /chat-hub-core:setup.")
} else {
  const guard = c.level >= 1 ? ensureGuard() : ''
  const me = hookInput().session_id || ''
  const hub = readHub(c)
  const to = hubAddress(hub)
  let who
  if (hub.session && me && hub.session === me) {
    who = 'This chat is the hub: load the chat-hub-core:hub skill now.' +
      (hub.app ? '' : ` Work chats can't message you yet: look up this session's own details with your session tools (its id starts with local_) and run ${setHubCmd} --app <that id>.`)
  } else if (hub.app) {
    who = `This project's hub is app session ${hub.app}. Look up this session's own details with your session tools: ` +
      `if its id is ${hub.app}, this chat is the hub (it was restarted or cleared): load the chat-hub-core:hub skill now and ` +
      `run ${setHubCmd} --session <this chat's session ID, below> --app ${hub.app}. Otherwise this is a work chat: ` +
      `load the chat-hub-core:work-chat skill now and only ever message ${hub.app}.`
  } else if (hub.session) {
    who = `This chat is a work chat: load the chat-hub-core:work-chat skill now. This project's hub is session ${hub.session}; ` +
      'only ever message that session (if the app won\'t accept that ID, ask the owner which chat is the hub). ' +
      'Become the hub only if the owner runs /chat-hub-core:hub here.'
  } else {
    who = 'No hub is recorded for this project. Load the chat-hub-core:work-chat skill, and tell the owner first thing: ' +
      '"No hub is recorded; type /chat-hub-core:hub in the chat that should be the hub." Until one is recorded, ' +
      'don\'t message any chat as the hub and don\'t guess one by its name.'
  }
  const mine = me ? ` This chat's session ID is ${me}.` : ''
  say('SessionStart', `This project uses chat-hub-core (level ${c.level}). ${who}${mine}${guard}`)
}
