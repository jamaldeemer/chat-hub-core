// How big a chat's context is, and how much it has cost so far, read from its transcript.
// Every turn re-reads the whole context, so cost ≈ turns × context size. The counts are kept
// in a small state file per session, and each run reads only what was added to the
// transcript since the last one, so this stays fast on long chats.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

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

// The size limit: `trimAt` for the hub (default 135k); work chats only if `trimAtWork` is set.
export const trimLimit = (isHub, cfg) => (isHub ? (cfg.trimAt ?? 135000) : (cfg.trimAtWork || 0))

// One level: past the limit the hub wraps up. It takes on no new work, finishes what it already
// has in flight, brings its notes up to date and only then asks to be cleared, so a clear never
// lands in the middle of a step.
export const wrapUpText = (ctx, limit) =>
  `⚠️ WRAP UP: this chat's context is ${short(ctx)} tokens, past its limit of ${short(limit)}, and every turn ` +
  're-reads all of it. Take on no new work: no new chats or releases, and nothing new the owner or a chat ' +
  'asks for (add each to "## Next" in your hub notes as a line starting "- After clear:", which the start note ' +
  'quotes back to you, and say it\'s noted for after the clear). ' +
  'Finish everything already in flight: a merge or release you have started (through its tests and commit), ' +
  'closing every chat whose wrap-up report is in (close-chat.mjs, then ✅: never leave one at ⏳ for after the clear), ' +
  'title changes you owe, replies to messages chats have sent you, and messages you said you would send. ' +
  'Until all of that is done, start each reply with "⚠️ Hub at ' + short(ctx) + ' tokens: wrapping up." Once it is, ' +
  'bring your hub notes up to date, then start every reply until you\'re cleared with ' +
  '"⚠️ Wrapped up, notes saved. Type /clear in this chat to clear it." ' +
  'Never ask the owner about clearing: no question, menu or buttons (a button can\'t clear a chat, and a ' +
  'cleared chat has nothing left to answer). In the desktop app, end the turn with a wrap-up recap only, ' +
  'no ask or actions.'

const workText = ctx =>
  `⚠️ STOP: this chat's context is ${short(ctx)} tokens, and every turn re-reads all of it. When you reach a ` +
  'natural stopping point, write down where you are (in your branch\'s notes or a commit) and tell the owner, ' +
  `starting your reply with "⚠️ This chat is at ${short(ctx)} tokens: please clear it or wrap it up." Repeat that line in every reply until cleared.`

// Past the limit: the note comes on every prompt, and once on a tool call when the chat first
// crosses it. Resets once the context drops below 80% of the limit (after a clear).
export function trimNudge({ session, isHub, cfg, everyTime = false }) {
  if (!session || !cfg) return ''
  const limit = trimLimit(isHub, cfg)
  if (!limit) return ''
  const s = readUsage(session)
  if (s.context < limit * 0.8 && s.nudgedAt) { s.nudgedAt = 0; writeUsage(session, s) }
  if (s.context < limit) return ''
  if (!everyTime && s.nudgedAt) return ''
  if (!s.nudgedAt) { s.nudgedAt = limit; writeUsage(session, s) }
  return isHub ? wrapUpText(s.context, limit) : workText(s.context)
}
