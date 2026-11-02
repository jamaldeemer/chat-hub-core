// /chat-hub-core:limit: show or change the context limits for every chat in this project, from
// the next prompt on, no restart: the hub's wrap-up limit (`trimAt`) and work chats' (`trimAtWork`).
// The prompt hook runs it when the owner types the command; by hand:
//   node limit.mjs                  show both limits
//   node limit.mjs 200k             the hub's limit (same as "hub 200k")
//   node limit.mjs work 100k        work chats' limit ("work off" turns it off)
//   node limit.mjs default          back to the settings ("hub default", "work default": one only)
// Kept in limits.json in git's shared folder (every worktree sees it, never committed); without
// git, written into .claude/chat-hub.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isMain, limitsFile, loadConfig, readLimits } from './config.mjs'
import { DEFAULT_TRIM_AT, hardStopAfter, short } from './usage.mjs'

export const LIMIT_USAGE = 'Type /chat-hub-core:limit to see the limits, /chat-hub-core:limit 200k for the hub, ' +
  '/chat-hub-core:limit work 100k (or "work off") for work chats, /chat-hub-core:limit default to go back to the settings.'

// "200k", "1.5M", "200000"; a bare number under 1000 is read as thousands ("200" = 200k). "off" = 0.
export function parseSize(w) {
  if (/^(off|0)$/i.test(w)) return 0
  const m = /^(\d+(?:\.\d+)?)([km])?$/i.exec(w.replace(/[,_]/g, ''))
  if (!m) return null
  const n = Number(m[1]) * ({ k: 1e3, m: 1e6 }[(m[2] || '').toLowerCase()] || (Number(m[1]) < 1000 ? 1e3 : 1))
  return Math.round(n)
}

const KEY = { hub: 'trimAt', work: 'trimAtWork' }

function describe(which, cfg, limits) {
  const key = KEY[which]
  const [v, from] = key in limits ? [limits[key], 'set with /chat-hub-core:limit']
    : key in cfg ? [cfg[key], 'from .claude/chat-hub.json']
    : [which === 'hub' ? DEFAULT_TRIM_AT : 0, 'default']
  const value = which === 'hub' ? (v ? `wraps up at ${short(v)}` : 'never wraps up')
    : (v ? `are asked to stop at ${short(v)}` : 'have no limit')
  return `${which === 'hub' ? 'hub' : 'work chats'} ${value} (${from})`
}

// Returns { ok, changed, text }. `dir` is the project folder whose settings are read.
export function limitCommand(args = '', dir = process.cwd()) {
  const words = String(args).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const which = words[0] in KEY ? words.shift() : null
  const word = words.shift()
  const { cfg: c } = loadConfig(dir)
  const cfg = c || {}
  // The hub's two stops (usage.mjs): new work at its limit, every tool but its notes `hardStopAfter` later.
  const stops = () => {
    const v = 'trimAt' in readLimits() ? readLimits().trimAt : cfg.trimAt ?? DEFAULT_TRIM_AT
    return v ? ` At its limit the hub can't start chats or releases; at ${short(v + hardStopAfter(cfg))} (${short(hardStopAfter(cfg))} ` +
      'more, hardStopAfter) it can only write its notes until cleared.' : ''
  }
  const show = (lead = '') => `${lead}Context limits: ${describe('hub', cfg, readLimits())}; ${describe('work', cfg, readLimits())}.${stops()}`
  if (words.length) return { ok: false, changed: false, text: `Not changed: didn't understand "${args.trim()}". ${LIMIT_USAGE}` }
  if (!word) return { ok: true, changed: false, text: show() }

  const limits = readLimits()
  const keys = which ? [KEY[which]] : (word === 'default' || word === 'reset') ? Object.values(KEY) : [KEY.hub]
  if (word === 'default' || word === 'reset') {
    for (const k of keys) delete limits[k]
  } else {
    const n = parseSize(word)
    if (n === null) return { ok: false, changed: false, text: `Not changed: "${word}" isn't a size like 200k. ${LIMIT_USAGE}` }
    if (n && (n < 20000 || n > 1000000)) {
      return { ok: false, changed: false, text: `Not changed: ${short(n)} is outside 20k–1M tokens (use "off" to turn it off).` }
    }
    limits[keys[0]] = n
  }

  const f = limitsFile()
  try {
    if (f) {
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, JSON.stringify(limits) + '\n')
    } else {
      // No git: the settings file is the only place every chat reads.
      if (!c) return { ok: false, changed: false, text: 'Not changed: this project has no .claude/chat-hub.json (run /chat-hub-core:setup).' }
      const next = { ...c }
      for (const k of keys) (k in limits ? (next[k] = limits[k]) : delete next[k])
      writeFileSync(`${dir}/.claude/chat-hub.json`, JSON.stringify(next, null, 2) + '\n')
      Object.assign(cfg, next); for (const k of keys) if (!(k in next)) delete cfg[k]
    }
  } catch (e) { return { ok: false, changed: false, text: `Not changed: couldn't save it (${e.message}).` } }
  return { ok: true, changed: true, text: show('Saved; every chat uses it from its next prompt. ') }
}

if (isMain(import.meta.url)) {
  const r = limitCommand(process.argv.slice(2).join(' '))
  console.log(r.text)
  process.exit(r.ok ? 0 : 1)
}
