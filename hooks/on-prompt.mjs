// When the owner types /chat-hub-core:hub, record this chat as the hub. Hooks run outside the
// chat's sandbox, so this can write git's shared folder even from a worktree.
import { hookInput, readConfig, say, setHub } from './config.mjs'

const input = hookInput()
const prompt = (input.prompt || '').trim()
if (/^\/chat-hub-core:hub\b/.test(prompt) && input.session_id && readConfig()) {
  try {
    const old = setHub(input.session_id)
    say('UserPromptSubmit', `Recorded this chat (session ${input.session_id}) as the hub.` +
      (old ? ` It replaced session ${old}; if that chat is still open, tell the owner.` : ''))
  } catch (e) {
    say('UserPromptSubmit', `Couldn't record this chat as the hub (${e.message}); run set-hub.mjs as the hub skill says.`)
  }
}
