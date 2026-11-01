// When the owner types /chat-hub-core:hub, record this chat as the hub. Hooks run outside the
// chat's sandbox, so this can write git's shared folder even from a worktree. If another chat is
// already the hub, it refuses unless the owner typed "/chat-hub-core:hub replace".
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { HubTaken, hookInput, isHubChat, readConfig, readHub, say, setHub } from './config.mjs'
import { trimNudge } from './usage.mjs'
import { limitCommand } from './limit.mjs'
import { rulesNotice } from './config.mjs'

const setHubCmd = `node "${dirname(fileURLToPath(import.meta.url))}/set-hub.mjs"`
const input = hookInput()
const prompt = (input.prompt || '').trim()
const m = prompt.match(/^\/chat-hub-core:hub\b(.*)$/s)
const cfg = readConfig(input.cwd || process.cwd())
// /chat-hub-core:limit [hub|work] [200k|off|default]: show or change the context limits. Done
// here, outside the chat's sandbox, before the nudge below so it already uses the new limit.
const lm = prompt.match(/^\/chat-hub-core:limit\b(.*)$/s)
let limitNote = "", limitChanged = false
if (lm && cfg) {
  const r = limitCommand(lm[1], input.cwd || process.cwd())
  limitChanged = r.changed
  limitNote = `chat-hub-core /limit: ${r.text} This is already done: tell the owner exactly that in one short ` +
    'reply and do nothing else for it.'
}
if (!m && cfg) {
  const isHub = isHubChat(readHub(cfg), input.session_id)
  const nudge = trimNudge({ session: input.session_id, isHub, cfg, everyTime: true })
  if (limitChanged && isHub && !nudge) {
    limitNote += ' No WRAP UP note came with this prompt, so you are under the hub\'s limit: if you were wrapping ' +
      'up, stop and carry on as normal.'
  }
  const out = [limitNote, rulesNotice({ session: input.session_id, isHub }), nudge].filter(Boolean).join(' ')
  if (out) say('UserPromptSubmit', out)
}
if (m && input.session_id && cfg) {
  try {
    const old = setHub({ session: input.session_id, replace: /^\s*replace\b/i.test(m[1]) })
    say('UserPromptSubmit', `Recorded this chat (session ${input.session_id}) as the hub.` +
      (old ? ` It replaced ${old}; if that isn't this chat and it's still open, tell the owner.` : '') +
      ` Now add your app address so work chats can message you: look up this session's own details with your` +
      ` session tools (its id starts with local_) and run: ${setHubCmd} --app <that id>`)
  } catch (e) {
    if (e instanceof HubTaken) {
      say('UserPromptSubmit', `NOT recorded as the hub: ${e.message}. Tell the owner exactly that, and that if that chat ` +
        'is closed or they want to switch hubs, they should type "/chat-hub-core:hub replace" here. Until then this ' +
        'chat is not the hub: do not load the hub rules.')
    } else {
      say('UserPromptSubmit', `Couldn't record this chat as the hub (${e.message}); tell the owner.`)
    }
  }
}
