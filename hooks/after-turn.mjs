// After every turn: one short line for the owner on how big this chat's context is and what it
// has cost so far. It goes to the owner only (systemMessage), never into Claude's context.
// Then the chat's own title: if its symbol, spacing or ʀ tag is wrong, the chat is sent back
// once to fix it (never twice in a row, so a rename that fails can't loop).
import { hookInput, isHubChat, readConfig, readHub } from './config.mjs'
import { statsLine, updateUsage } from './usage.mjs'
import { titleNote } from './titles.mjs'
import { withPace } from './pace.mjs'

const input = hookInput()
const cfg = readConfig(input.cwd || process.cwd())
if (!cfg || !input.session_id) process.exit(0)
const out = {}
if (cfg.stats !== false) {
  const s = updateUsage(input.session_id, input.transcript_path)
  if (s.turns) out.systemMessage = withPace(statsLine(s), cfg)
}
if (!input.stop_hook_active) {
  let workChat = true
  try { workChat = !isHubChat(readHub(cfg), input.session_id) } catch {}
  const note = titleNote(input, { workChat })
  if (note) Object.assign(out, { decision: 'block', reason: note })
}
if (Object.keys(out).length) process.stdout.write(JSON.stringify(out))
