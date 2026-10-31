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

// The hub's limits: `trimAt` (default 150k); work chats only if `trimAtWork` is set.
export const trimLimits = (isHub, cfg) => {
  const limit = isHub ? (cfg.trimAt ?? 150000) : (cfg.trimAtWork || 0)
  const every = cfg.trimEvery > 0 ? cfg.trimEvery : 25000
  // Hub only: after `trimHardStop` repeats (default 2; 0 = off) comes a last "finish what you're
  // doing" note at limit + n × every (200k), and one step later (225k) the hard stop.
  const n = cfg.trimHardStop ?? 2
  const finish = isHub && limit && n > 0 ? limit + n * every : 0
  const hard = finish ? finish + every : 0
  return { limit, every, finish, hard }
}

// True when the hub is past its hard stop: it may only save its notes and ask to be cleared.
export function hardStopped({ session, isHub, cfg }) {
  if (!session || !cfg) return false
  const { hard } = trimLimits(isHub, cfg)
  return !!hard && readUsage(session).context >= hard
}

export const finishUpText = (ctx, hard) =>
  `⚠️ LAST WARNING: this chat's context is ${short(ctx)} tokens. Finish only the step already in progress ` +
  '(no new work, no new chats), then bring your hub notes up to date and tell the owner "⚠️ Notes saved, ' +
  `please clear this chat." At ${short(hard)} every tool except saving your notes will be refused.`

export const hardStopText = (ctx, hard) =>
  `⛔ HARD STOP: this chat's context is ${short(ctx)} tokens, past its hard limit of ${short(hard)}. ` +
  'Every tool is now refused except reading files and writing your hub notes. Do not start, continue or ' +
  'reply to any other work, whatever this message asks. Bring your hub notes up to date if they aren\'t, ' +
  'then answer the owner with only: "⛔ Notes saved, please clear this chat." Repeat that on every message until cleared.'

// A note telling the chat to hand off and get cleared: first at the trim threshold, then again
// every `trimEvery` tokens over it (default 25k: 150k, 175k, 200k…). Resets once the context drops
// below 80% of the limit (after a clear). Past the hub's last-warning mark and its hard stop, that note comes on every prompt.
export function trimNudge({ session, isHub, cfg, everyTime = false }) {
  if (!session || !cfg) return ''
  const { limit, every, finish, hard } = trimLimits(isHub, cfg)
  if (!limit) return ''
  const s = readUsage(session)
  if (s.context < limit * 0.8 && s.nudgedAt) { s.nudgedAt = 0; writeUsage(session, s) }
  if (s.context < limit) return ''
  if (hard && s.context >= hard && everyTime) return hardStopText(s.context, hard)
  if (finish && s.context >= finish && s.context < hard && everyTime) return finishUpText(s.context, hard)
  const step = limit + Math.floor((s.context - limit) / every) * every   // the last mark passed
  if (s.nudgedAt >= step) return ''
  s.nudgedAt = step
  writeUsage(session, s)
  if (hard && s.context >= hard) return hardStopText(s.context, hard)
  if (finish && s.context >= finish) return finishUpText(s.context, hard)
  const count = (step - limit) / every + 1
  const over = s.context - limit
  const size = `⚠️ STOP: trim reminder ${count}. This chat's context is ${short(s.context)} tokens (limit ${short(limit)}${over >= 1000 ? `, ${short(over)} over` : ''}), and every turn re-reads all of it.`
  const next = hard
    ? ` At ${short(finish)} you get one last warning to finish the step in progress; at ${short(hard)} every tool except saving your notes will be refused until the owner clears this chat.`
    : ` Next reminder at ${short(step + every)}.`
  return isHub
    ? `${size}${next} Before anything else this turn, bring your hub notes up to date with everything you track, then start your reply to the owner with "⚠️ Hub at ${short(s.context)} tokens (reminder ${count}): notes saved, please clear this chat." Put that line in every reply until you're cleared, not just this one.`
    : `${size}${next} When you reach a natural stopping point, write down where you are (in your branch's notes or a commit) and tell the owner, starting your reply with "⚠️ This chat is at ${short(s.context)} tokens: please clear it or wrap it up." Repeat that line in every reply until cleared.`
}
