// Record a chat as this project's hub: node set-hub.mjs <session-id>
// Writes git's shared folder (every worktree sees it); without git, .claude/chat-hub.json.
import { setHub } from './config.mjs'

const id = (process.argv[2] || '').trim()
if (!id) { console.error('usage: node set-hub.mjs <session-id>'); process.exit(2) }
const old = setHub(id)
console.log(old ? `Hub is now ${id} (was ${old}).` : `Hub is now ${id}.`)
