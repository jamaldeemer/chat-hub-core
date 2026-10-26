// When the owner types /chat-hub-core:hub, record this chat as the hub. Hooks run outside the
// chat's sandbox, so this can write git's shared folder even from a worktree.
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { hookInput, readConfig, say, setHub } from './config.mjs'

const setHubCmd = `node "${dirname(fileURLToPath(import.meta.url))}/set-hub.mjs"`
const input = hookInput()
const prompt = (input.prompt || '').trim()
if (/^\/chat-hub-core:hub\b/.test(prompt) && input.session_id && readConfig()) {
  try {
    const old = setHub({ session: input.session_id })
    say('UserPromptSubmit', `Recorded this chat (session ${input.session_id}) as the hub.` +
      (old ? ` It replaced ${old}; if that isn't this chat and it's still open, tell the owner.` : '') +
      ` Now add your app address so work chats can message you: look up this session's own details with your` +
      ` session tools (its id starts with local_) and run: ${setHubCmd} --app <that id>`)
  } catch (e) {
    say('UserPromptSubmit', `Couldn't record this chat as the hub (${e.message}); run set-hub.mjs as the hub skill says.`)
  }
}
