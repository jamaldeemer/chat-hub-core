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

// A note telling the chat to hand off and get cleared: first at the trim threshold, then again
// every `trimEvery` tokens over it (default 25k: 150k, 175k, 200k…). Resets once the context drops
// below 80% of the limit (after a clear). The hub's threshold is `trimAt` (default 150k); work
// chats only if `trimAtWork` is set.
export function trimNudge({ session, isHub, cfg }) {
  if (!session || !cfg) return ''
  const limit = isHub ? (cfg.trimAt ?? 150000) : (cfg.trimAtWork || 0)
  if (!limit) return ''
  const every = cfg.trimEvery > 0 ? cfg.trimEvery : 25000
  const s = readUsage(session)
  if (s.context < limit * 0.8 && s.nudgedAt) { s.nudgedAt = 0; writeUsage(session, s) }
  if (s.context < limit) return ''
  const step = limit + Math.floor((s.context - limit) / every) * every   // the last mark passed
  if (s.nudgedAt >= step) return ''
  s.nudgedAt = step
  writeUsage(session, s)
  const over = s.context - limit
  const size = `This chat's context is ${short(s.context)} tokens (limit ${short(limit)}${over >= 1000 ? `, ${short(over)} over` : ''}), and every turn re-reads all of it.`
  return isHub
    ? `${size} At the next quiet moment (nothing waiting on you mid-step), bring your hub notes up to date with everything you track, then ask the owner to clear this chat: you'll pick up from the notes. Say it once; don't stop work in progress for it.`
    : `${size} When you reach a natural stopping point, write down where you are (in your branch's notes or a commit) and suggest the owner clear this chat or wrap it up. Say it once.`
}
