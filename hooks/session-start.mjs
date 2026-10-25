// At the start of every chat: tell Claude which chat-hub-core rules apply here.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readConfig, say } from './config.mjs'

// Level 1+: is git using a hooks folder with our pre-push? (core.hooksPath isn't committed, so each clone needs it.)
function guardOff() {
  try {
    const dir = execFileSync('git', ['config', 'core.hooksPath'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    return !existsSync(`${dir}/pre-push`)
  } catch {
    return existsSync('.githooks/pre-push') // set up here, but this clone hasn't switched it on
  }
}

const c = readConfig()
if (!c) {
  say('SessionStart', 'The chat-hub-core plugin is installed but this project is not set up. If the owner asks about chats, hubs or releases, suggest /chat-hub-core:setup.')
} else {
  const guard = c.level >= 1 && guardOff()
    ? ' The push guard on main is off in this checkout: tell the owner once to run `git config core.hooksPath .githooks`.'
    : ''
  // The hub's name is per project (settings `hub`), so chats in two projects never mix up their hubs.
  const hub = c.hub || 'Hub'
  const match = c.hub ? `is exactly "${hub}"` : `is or ends with "${hub}"`
  say(
    'SessionStart',
    `This project uses chat-hub-core (level ${c.level}). Look up this chat's name. If it ${match}, ` +
      'this chat is the hub: load the chat-hub-core:hub skill now. Otherwise it is a work chat: ' +
      `load the chat-hub-core:work-chat skill now. This project's hub is "${hub}"; other projects have hubs too, ` +
      `so only ever message this one (by the session ID in your brief when there is one). Settings: .claude/chat-hub.json.${guard}`,
  )
}
