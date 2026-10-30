// After every turn: one short line for the owner on how big this chat's context is and what it
// has cost so far. It goes to the owner only (systemMessage), never into Claude's context.
import { hookInput, readConfig } from './config.mjs'
import { short, updateUsage } from './usage.mjs'

const input = hookInput()
const cfg = readConfig(input.cwd || process.cwd())
if (cfg?.stats === false || !input.session_id) process.exit(0)
const s = updateUsage(input.session_id, input.transcript_path)
if (!s.turns) process.exit(0)
process.stdout.write(JSON.stringify({
  systemMessage: `Context ${short(s.context)} · ${s.turns} turns · this chat ≈ ${short(s.reads)} token-reads`,
}))
