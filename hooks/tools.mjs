// /chat-hub-core:tools: show or change which heavy tools this project's chats load. Every tool a
// chat has costs context on every turn, the hub's most of all. A bare tool name in
// permissions.deny removes the tool from the chat entirely, so this adds or removes those rules
// in the project's .claude/settings.local.json (personal, never committed). Desktop-app worktree
// chats read the main checkout's settings, so the file is written there and every chat (hub and
// work chats) gets the same set. The prompt hook runs it outside the chat's sandbox; by hand:
//   node tools.mjs                     show what's on and off
//   node tools.mjs off browser ios     turn groups off ("off unused": the usual set)
//   node tools.mjs on browser          turn groups back on ("on all": every group)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { isMain } from './config.mjs'

// Groups of tools a project often doesn't need. `rules` are the exact deny rules we own: an MCP
// server's name covers all its tools. Only these exact rules are ever added or removed.
export const GROUPS = {
  browser: { label: 'Browser pane', rules: ['mcp__Claude_Browser'] },
  chrome: { label: 'Claude in Chrome', rules: ['mcp__claude-in-chrome'] },
  ios: { label: 'iOS simulator', rules: ['mcp__Claude_Code_iOS_Simulator'] },
  charts: { label: 'inline charts and diagrams', rules: ['mcp__visualize'] },
  artifacts: { label: 'Artifacts (published pages)', rules: ['Artifact', 'ArtifactComments', 'ArtifactData'] },
  workflows: { label: 'Workflows (multi-agent scripts)', rules: ['Workflow'] },
  suggestions: { label: 'plugin and skill suggestions', rules: ['SearchPlugins', 'SuggestPluginInstall', 'SuggestSkills'] },
}
// "off unused": what a project without a web UI or iOS app rarely needs.
export const UNUSED = Object.keys(GROUPS)

export const TOOLS_USAGE = 'Type /chat-hub-core:tools to see them, /chat-hub-core:tools off browser ios (or ' +
  '"off unused") to turn groups off, /chat-hub-core:tools on browser (or "on all") to turn them back on. Groups: ' +
  Object.keys(GROUPS).join(', ') + '.'

// The main checkout's folder (worktree chats read their settings from there); `dir` without git.
export function projectRoot(dir = process.cwd()) {
  try {
    const g = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (g && basename(g) === '.git') return dirname(g)
  } catch {}
  return dir
}

export const settingsFile = (dir = process.cwd()) => `${projectRoot(dir)}/.claude/settings.local.json`

function readSettings(f) {
  if (!existsSync(f)) return {}
  const o = JSON.parse(readFileSync(f, 'utf8'))
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(`${f} is not a JSON object`)
  return o
}

const isOff = (deny, g) => GROUPS[g].rules.every(r => deny.includes(r))

function describe(deny) {
  const off = Object.keys(GROUPS).filter(g => isOff(deny, g))
  const on = Object.keys(GROUPS).filter(g => !isOff(deny, g))
  return `Tools off: ${off.length ? off.join(', ') : 'none'}; on: ${on.length ? on.join(', ') : 'none'}.`
}

// Returns { ok, changed, text }. `dir` is the chat's folder.
export function toolsCommand(args = '', dir = process.cwd()) {
  const words = String(args).trim().toLowerCase().split(/[\s,]+/).filter(Boolean)
  const f = settingsFile(dir)
  let s
  try { s = readSettings(f) } catch (e) { return { ok: false, changed: false, text: `Not changed: couldn't read ${f} (${e.message}).` } }
  const deny = Array.isArray(s.permissions?.deny) ? s.permissions.deny : []
  if (!words.length) return { ok: true, changed: false, text: describe(deny) }

  const mode = words.shift()
  if (mode !== 'off' && mode !== 'on') return { ok: false, changed: false, text: `Not changed: didn't understand "${args.trim()}". ${TOOLS_USAGE}` }
  let groups = words
  if (groups.length === 1 && (groups[0] === 'unused' || groups[0] === 'all')) groups = mode === 'off' ? UNUSED : Object.keys(GROUPS)
  const bad = groups.filter(g => !(g in GROUPS))
  if (!groups.length || bad.length) {
    return { ok: false, changed: false, text: `Not changed: ${bad.length ? `no group called "${bad.join('", "')}"` : 'no group named'}. ${TOOLS_USAGE}` }
  }

  const rules = groups.flatMap(g => GROUPS[g].rules)
  const next = mode === 'off' ? [...deny, ...rules.filter(r => !deny.includes(r))] : deny.filter(r => !rules.includes(r))
  if (next.length === deny.length && next.every((r, i) => r === deny[i])) return { ok: true, changed: false, text: `Nothing to change. ${describe(deny)}` }
  const perms = { ...(s.permissions || {}), deny: next }
  if (!next.length) delete perms.deny
  const out = { ...s, permissions: perms }
  if (!Object.keys(perms).length) delete out.permissions
  try {
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, JSON.stringify(out, null, 2) + '\n')
  } catch (e) { return { ok: false, changed: false, text: `Not changed: couldn't save ${f} (${e.message}).` } }
  return {
    ok: true, changed: true,
    text: `Saved in .claude/settings.local.json (just you, never committed). ${describe(next)} New chats load the ` +
      'new set; restart an open chat for it to drop or get them.',
  }
}

if (isMain(import.meta.url)) {
  const r = toolsCommand(process.argv.slice(2).join(' '))
  console.log(r.text)
  process.exit(r.ok ? 0 : 1)
}
