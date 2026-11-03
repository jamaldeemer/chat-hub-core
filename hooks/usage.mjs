// How big a chat's context is, and how much it has cost so far, read from its transcript.
// Every turn re-reads the whole context, so cost ≈ turns × context size. The counts are kept
// in a small state file per session, and each run reads only what was added to the
// transcript since the last one, so this stays fast on long chats.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pluginVersion, readLimits } from './config.mjs'

const dir = `${tmpdir()}/chat-hub-core`
const stateFile = session => `${dir}/${String(session).replace(/[^\w-]/g, '_')}.json`
const fresh = () => ({ offset: 0, lastId: '', turns: 0, reads: 0, context: 0, nudgedAt: 0 })

export function readUsage(session) {
  try { return { ...fresh(), ...JSON.parse(readFileSync(stateFile(session), 'utf8')) } } catch { return fresh() }
}
export function writeUsage(session, state) {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(stateFile(session), JSON.stringify(state)) } catch {}
}

// The context one assistant message was sent with: everything the model read for that turn.
const contextOf = u => (u?.input_tokens || 0) + (u?.cache_read_input_tokens || 0) + (u?.cache_creation_input_tokens || 0)

// Read the transcript from where we stopped last time and update the counts.
export function updateUsage(session, transcript) {
  const s = readUsage(session)
  if (!transcript || !existsSync(transcript)) return s
  const fd = openSync(transcript, 'r')
  try {
    const size = fstatSync(fd).size
    if (size < s.offset) Object.assign(s, fresh())          // a new or rewritten transcript
    if (size === s.offset) return s
    const buf = Buffer.alloc(size - s.offset)
    readSync(fd, buf, 0, buf.length, s.offset)
    const text = buf.toString('utf8')
    const end = text.lastIndexOf('\n')                      // only whole lines; the rest waits for next time
    if (end < 0) return s
    for (const line of text.slice(0, end).split('\n')) {
      if (!line.includes('"assistant"') || !line.includes('"usage"')) continue
      let e
      try { e = JSON.parse(line) } catch { continue }
      if (e.type !== 'assistant' || e.isSidechain || !e.message?.usage) continue
      const id = e.message.id || e.uuid
      if (id === s.lastId) continue                         // one message is written as several lines
      s.lastId = id
      const ctx = contextOf(e.message.usage)
      s.turns += 1
      s.reads += ctx
      s.context = ctx
    }
    s.offset += Buffer.byteLength(text.slice(0, end + 1), 'utf8')
  } finally { closeSync(fd) }
  writeUsage(session, s)
  return s
}

export const short = n => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))

// The owner's one-line note (a systemMessage, never in Claude's context), shown after every turn
// and when a chat starts. A chat with no turns yet shows the version and "new chat". Right after
// a compact the last context size is out of date, so it says "compacted" instead.
export function statsLine(s, { compacted = false } = {}) {
  const parts = [`chat-hub-core ${pluginVersion()}`]
  if (!s.turns) parts.push('new chat')
  else parts.push(compacted ? 'Context compacted' : `Context ${short(s.context)}`, `${s.turns} turns`,
    `this chat ≈ ${short(s.reads)} token-reads`)
  return parts.join(' · ')
}

// The size limit: `trimAt` for the hub (default 135k); work chats only if `trimAtWork` is set.
// A limit set with /chat-hub-core:limit (limits.json) wins over the settings.
export const DEFAULT_TRIM_AT = 135000
export function trimLimit(isHub, cfg, limits = readLimits()) {
  const c = { ...cfg, ...limits }
  return isHub ? (c.trimAt ?? DEFAULT_TRIM_AT) : (c.trimAtWork || 0)
}

// Past the limit the hub's hooks stop it in two stages (hub only; work chats just get a note):
//   stage 1, at the limit: no new work. Starting a chat and building a release are refused;
//     finishing what's in flight (merges, close-chat, titles, messages, notes) still works.
//   stage 2, `hardStopAfter` (default 20k) past it: every tool but reading and writing the
//     hub notes is refused, and every reply says to type /clear.
// Only the owner gets past them, with /chat-hub-core:limit (the prompt hook runs it).
export const DEFAULT_HARD_STOP_AFTER = 20000
export const hardStopAfter = cfg => {
  const n = Number(cfg?.hardStopAfter)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HARD_STOP_AFTER
}
export function hubStage(ctx, cfg, limit = trimLimit(true, cfg)) {
  if (!limit || ctx < limit) return 0
  return ctx >= limit + hardStopAfter(cfg) ? 2 : 1
}

// How the owner gets past a stop: the chat itself never can.
export const OVERRIDE = 'Only the owner can lift this: they type /chat-hub-core:limit <a higher limit, e.g. 200k> ' +
  'or /chat-hub-core:limit off. Never try to change the limit, the hub record or the usage counts yourself.'

// The line a chat shows once it has nothing left to do but be cleared: hard to miss.
export const SAFE_BANNER =
  '╔════════════════════════════════════╗\n' +
  '║   ✅  SAFE TO CLEAR: type /clear   ║\n' +
  '╚════════════════════════════════════╝'
// The title symbol for a chat showing that banner, so the owner spots it in the sidebar.
export const CLEAR_SYMBOL = '🔄'
const titleRule = `In the same turn you first show it, set your title's symbol to ${CLEAR_SYMBOL} (waiting for the owner ` +
  'to clear): read your title (get_session self), swap only its first character and set it (set_session_title ' +
  'with self), keeping the rest exactly. After the clear, set your normal status again. '
const bannerRule = 'start every reply until you\'re cleared with this banner, as its own code block (```), ' +
  'exactly:\n```\n' + SAFE_BANNER + '\n```\n' + titleRule

// Stage 1: the hub wraps up. It takes on no new work, finishes what it already has in flight,
// brings its notes up to date and only then shows the banner, so a clear never lands in the
// middle of a step.
export const wrapUpText = (ctx, limit, cfg) =>
  `⚠️ WRAP UP: this chat's context is ${short(ctx)} tokens, past its limit of ${short(limit)}, and every turn ` +
  're-reads all of it. Take on no new work: no new chats or releases (the hooks now refuse both), and nothing new the owner or a chat ' +
  'asks for (add each to "## Next" in your hub notes as a line starting "- After clear:", which the start note ' +
  'quotes back to you, and say it\'s noted for after the clear). ' +
  'Finish everything already in flight: a merge you have started (through its tests and commit), ' +
  'closing every chat whose wrap-up report is in (close-chat.mjs, then ✅: never leave one at ⏳ for after the clear or a later release), ' +
  'title changes you owe, replies to messages chats have sent you, and messages you said you would send. ' +
  'Until all of that is done, start each reply with the plain line "⚠️ Hub at ' + short(ctx) + ' tokens: wrapping up." Once it is, ' +
  'bring your hub notes up to date, then ' + bannerRule +
  `At ${short(limit + hardStopAfter(cfg))} tokens the hooks refuse every tool but your notes, so finish soon. ` +
  'Never ask the owner about clearing: no question, menu or buttons (a button can\'t clear a chat, and a ' +
  'cleared chat has nothing left to answer). In the desktop app, end the turn with a wrap-up recap only, ' +
  'no ask or actions. ' + OVERRIDE

// Stage 2: only the notes are left.
export const hardStopText = (ctx, limit, notes) =>
  `⛔ HARD STOP: this chat's context is ${short(ctx)} tokens, well past its limit of ${short(limit)}. Every tool ` +
  `is refused except reading and writing your hub notes (${notes || 'hub-notes.md'}) with Read, Edit or Write. ` +
  'If they aren\'t up to date, bring them up to date now (anything unfinished goes under "## Next" as ' +
  '"- After clear: …"), then ' + bannerRule +
  'Do nothing else. Never ask the owner about clearing: no question, menu or buttons. ' + OVERRIDE

// A work chat past `trimAtWork`. A clear loses everything not written down, so before the banner
// it logs what a fresh chat needs in its own notes file, which the start note quotes back.
// A request that came with this very prompt counts too: that's the one most easily lost.
const workText = (ctx, cfg, notes) =>
  `⚠️ STOP: this chat's context is ${short(ctx)} tokens, and every turn re-reads all of it. Start nothing new: ` +
  'get to a natural stopping point. Then write down in ' + (notes ? `your chat notes (${notes})` : 'your chat notes (no file without git: put them in a commit)') +
  ', under "## Next", one line starting "- After clear:" for each of these: every request from the owner you ' +
  'haven\'t finished (including one that came with this message: noted, not started), every question you asked ' +
  'the owner that has no answer yet, and where your work stands (what\'s done, committed or pushed, and the next step). ' +
  'The start note after the clear quotes exactly those lines back, and nothing else: a backlog entry or a commit ' +
  `alone is not enough. Until that's written, start each reply with the plain line "⚠️ This chat is at ${short(ctx)} ` +
  'tokens: wrapping up." Once it is, tell the owner what you noted for after the clear, and ' + bannerRule +
  ((cfg?.level || 0) >= 2 ? 'Don\'t promise to check CI after the clear: the start note checks it for you.' : '')

// Past the limit: the note comes on every prompt, and once on a tool call when the chat first
// crosses it. Resets once the context drops below 80% of the limit (after a clear).
export function trimNudge({ session, isHub, cfg, everyTime = false, notes = '' }) {
  if (!session || !cfg) return ''
  const limit = trimLimit(isHub, cfg)
  if (!limit) return ''
  const s = readUsage(session)
  // A new limit (nudgedAt keeps the one it nudged at) counts as a fresh start too.
  if (s.nudgedAt && (s.context < limit * 0.8 || s.nudgedAt !== limit)) { s.nudgedAt = 0; writeUsage(session, s) }
  if (s.context < limit) return ''
  if (!everyTime && s.nudgedAt) return ''
  if (!s.nudgedAt) { s.nudgedAt = limit; writeUsage(session, s) }
  if (!isHub) return workText(s.context, cfg, notes)
  return hubStage(s.context, cfg, limit) === 2 ? hardStopText(s.context, limit, notes) : wrapUpText(s.context, limit, cfg)
}
