// After every turn: one short line for the owner on how big this chat's context is and what it
// has cost so far. It goes to the owner only (systemMessage), never into Claude's context.
// Then the chat's own title: if its symbol, spacing or ʀ tag is wrong, the chat is sent back
// once to fix it (never twice in a row, so a rename that fails can't loop).
import { hookInput, isHubChat, readConfig, readHub } from './config.mjs'
import { chatLimit, statsLine, updateUsage } from './usage.mjs'
import { titleNote } from './titles.mjs'
import { countNote } from './books.mjs'
import { syncSession } from './session-sync.mjs'
import { withPace } from './pace.mjs'

const input = hookInput()
const cfg = readConfig(input.cwd || process.cwd())
if (!cfg || !input.session_id) process.exit(0)
// A restart gives this chat a new session ID with no start note: re-record it before the title check.
syncSession(input.session_id, { cfg })
const out = {}
const s = updateUsage(input.session_id, input.transcript_path)
if (cfg.stats !== false) {
  if (s.turns) out.systemMessage = withPace(statsLine(s), cfg)
}
if (!input.stop_hook_active) {
  let workChat = true
  try { workChat = !isHubChat(readHub(cfg), input.session_id) } catch {}
  // 🔄 (waiting for /clear) is only right past the limit: after a clear it's sent back.
  const limit = chatLimit(input.session_id, !workChat, cfg)
  const pastLimit = !!limit && s.context >= limit
  // The hub's open count, after a turn that may have set ✅ or started a chat: sent back once.
  const note = titleNote(input, { workChat, pastLimit }) ||
    (workChat ? '' : (c => c ? `${c} Then end your turn: don't repeat your last reply.` : '')(
      countNote({ cfg, session: input.session_id, transcript: input.transcript_path, dir: input.cwd || process.cwd() })))
  if (note) Object.assign(out, { decision: 'block', reason: note })
}
if (Object.keys(out).length) process.stdout.write(JSON.stringify(out))
