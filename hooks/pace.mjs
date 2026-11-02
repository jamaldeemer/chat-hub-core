// The owner's plan-usage pace: how far through the week's usage they are against how far
// through the week it is. Hooks can't read plan usage themselves, so it comes from the app's
// get_usage tool: plan-usage.mjs saves each result a chat gets (any chat; usage is the
// account's), and this formats the saved numbers for the owner's line after every turn.
// The hub is asked to call get_usage at most once an hour (paceNudge), so it costs almost nothing.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const HOUR = 3600e3, DAY = 24 * HOUR, WEEK = 7 * DAY
export const PACE_EVERY = HOUR                    // how often the hub refreshes the numbers
export const planFile = () => process.env.CHAT_HUB_PLAN_FILE || `${tmpdir()}/chat-hub-core/plan-usage.json`

export function readPlan() {
  try { return JSON.parse(readFileSync(planFile(), 'utf8')) || {} } catch { return {} }
}
function writePlan(p) {
  try { mkdirSync(planFile().replace(/\/[^/]*$/, ''), { recursive: true }); writeFileSync(planFile(), JSON.stringify(p)) } catch {}
}

// get_usage's result as the hook gets it: the JSON itself, a string, or MCP content blocks.
export function planFrom(resp) {
  if (typeof resp === 'string') { try { return planFrom(JSON.parse(resp)) } catch { return null } }
  if (Array.isArray(resp)) { for (const b of resp) { const p = planFrom(b?.text ?? b); if (p) return p } return null }
  if (!resp || typeof resp !== 'object') return null
  if (resp.plan && typeof resp.plan === 'object') return resp.plan
  if (resp.content) return planFrom(resp.content)
  if (typeof resp.text === 'string') return planFrom(resp.text)
  return null
}

// Keep only what the line needs: the 5-hour and weekly (all models) windows.
export function savePlan(plan, now = Date.now()) {
  const win = re => (plan.windows || []).find(w => re.test(w?.label || ''))
  const keep = w => w && Number.isFinite(w.percentUsed) && Date.parse(w.resetsAt) ?
    { used: w.percentUsed, resetsAt: Date.parse(w.resetsAt) } : undefined
  const p = { ...readPlan(), savedAt: now, status: plan.status || 'ok',
    week: keep(win(/^weekly.*all models/i) || win(/^weekly(?!.*·)/i)), five: keep(win(/5-hour/i)) }
  writePlan(p)
  return p
}

const when = t => {
  const d = new Date(t), h = d.getHours()
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`
}
const ago = ms => (ms < DAY ? `${Math.round(ms / HOUR)}h old` : `${Math.round(ms / DAY)}d old`)

// e.g. "Week 78% used · 57% of week gone · 21 ahead · runs out ~Tue 8pm · 7%/day lasts the week · 5h 23%"
// "ahead" means used faster than an even pace. Empty when there's nothing current to show.
export function paceLine(p = readPlan(), now = Date.now()) {
  if (!p.savedAt || p.status !== 'ok') return ''
  const at = p.savedAt, parts = []
  const w = p.week
  if (w && w.resetsAt > now) {
    const used = w.used, start = w.resetsAt - WEEK
    const gone = Math.min(100, Math.max(0, ((at - start) / WEEK) * 100))
    const diff = Math.round(used - gone)
    parts.push(`Week ${used}% used`, `${Math.round(gone)}% of week gone`,
      Math.abs(diff) < 3 ? 'on pace' : `${Math.abs(diff)} ${diff > 0 ? 'ahead' : 'behind'}`)
    if (used >= 100) parts.push(`used up till ${when(w.resetsAt)}`)
    else {
      const rate = used / Math.max(at - start, HOUR)          // % per ms so far this week
      const out = rate > 0 ? at + (100 - used) / rate : Infinity
      parts.push(out >= w.resetsAt ? 'lasts the week' : `runs out ~${when(out)}`)
      const days = (w.resetsAt - at) / DAY
      if (days >= 1) parts.push(`${Math.floor((100 - used) / days)}%/day lasts the week`)
    }
  }
  if (p.five && p.five.resetsAt > now) parts.push(`5h ${p.five.used}%`)
  if (!parts.length) return ''
  const age = now - at
  return parts.join(' · ') + (age >= PACE_EVERY ? ` (${ago(age)})` : '')
}

// The owner's line with the pace under it (unless `"pace": false`).
export const withPace = (line, cfg) => (l => (l ? `${line}\n${l}` : line))(cfg?.pace === false ? '' : paceLine())

// The hub's one-line ask, at most once per PACE_EVERY, only in the desktop app (which has the tool).
export function paceNudge(cfg, now = Date.now()) {
  if (!cfg || cfg.pace === false || cfg.stats === false || !process.env.CLAUDE_CODE_HOST_SESSION_ID) return ''
  const p = readPlan()
  if (now - (p.savedAt || 0) < PACE_EVERY || now - (p.askedAt || 0) < PACE_EVERY) return ''
  writePlan({ ...p, askedAt: now })
  return PACE_ASK
}
const PACE_ASK =
  'Usage pace: call the get_usage session tool once this turn, alongside your other work ' +
  '(load it with ToolSearch "select:mcp__ccd_session_mgmt__get_usage" if it isn\'t loaded). A hook ' +
  'saves the plan numbers for the owner\'s pace line; don\'t mention it or the numbers.'
