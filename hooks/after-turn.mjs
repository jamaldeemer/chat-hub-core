// After every turn: one short line for the owner on how big this chat's context is and what it
// has cost so far. It goes to the owner only (systemMessage), never into Claude's context.
// Then the chat's own title: if its symbol, spacing or ʀ tag is wrong, the chat is sent back
// once to fix it (never twice in a row, so a rename that fails can't loop).
import { chatRole, hookInput, readConfig } from './config.mjs'
import { CLEAR_SYMBOL, chatLimit, clearAskText, clearEarlyText, readUsage, statsLine, turnEndsWithBanner, updateUsage, writeUsage } from './usage.mjs'
import { noMarks, readTitle, titleNote } from './titles.mjs'
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
  // Split hubs: the user hub's title is checked like the hub's (⚪ is fine), but it has no open count.
  let role = 'work'
  try { role = chatRole(input.session_id, cfg) } catch {}
  const workChat = role === 'work'
  // 🔄 (waiting for /clear) is only right past the limit: after a clear it's sent back.
  const limit = chatLimit(input.session_id, !workChat, cfg)
  const pastLimit = !!limit && s.context >= limit
  // 🔄 only once the wrap-up is really done: past the limit, a turn that ended with the SAFE TO
  // CLEAR banner (all its tools already run) is asked for 🔄, and the guard lets it set it only
  // then. 🔄 on a turn that didn't end with the banner is sent back: the chat is still busy.
  let clear = ''
  const title = pastLimit ? readTitle(input) : ''
  if (title) {
    const has = title.startsWith(CLEAR_SYMBOL), done = turnEndsWithBanner(input.transcript_path)
    if (done && !has) {
      clear = clearAskText()
      const u = readUsage(input.session_id); u.clearAsk = true; writeUsage(input.session_id, u)
    } else if (has && !done) clear = clearEarlyText(workChat)
  }
  // The hub's open count, after a turn that may have set ✅ or started a chat: sent back once.
  const count = role !== 'hub' ? '' : countNote({ cfg, session: input.session_id, transcript: input.transcript_path, dir: input.cwd || process.cwd() })
  const note = titleNote(input, { workChat, pastLimit, marks: !noMarks(cfg) }) ||
    (clear && count ? `${count} ${clear}` : clear || (count ? `${count} Then end your turn: don't repeat your last reply.` : ''))
  if (note) Object.assign(out, { decision: 'block', reason: note })
}
if (Object.keys(out).length) process.stdout.write(JSON.stringify(out))
