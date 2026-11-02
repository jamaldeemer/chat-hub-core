// /chat-hub-core:tools: show or change which tools this project's chats load. Every tool a chat
// has costs context on every turn, the hub's most of all. A bare tool name in permissions.deny
// removes the tool from the chat entirely, so this adds or removes those rules in the project's
// .claude/settings.local.json (personal, never committed). Desktop-app worktree chats read the
// main checkout's settings, so the file is written there and every chat (hub and work chats)
// gets the same set. The prompt hook runs it outside the chat's sandbox; by hand:
//   node tools.mjs                          list every group and tool, on or off
//   node tools.mjs off artifacts ios        turn groups (or single tools) off
//   node tools.mjs on browser SendUserFile  turn them back on
//   "off unused": the rarely used extras; "on all": every group back on
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { isMain } from './config.mjs'

// Every tool a desktop-app chat gets, in groups. `rules` are the exact deny rules for a group:
// an MCP server's name covers all its tools. `unused`: in the rarely used extras.
export const GROUPS = {
  browser: { label: 'Browser pane (keep for a web UI)', rules: ['mcp__Claude_Browser'] },
  ios: { label: 'iOS simulator (keep for an iOS app)', rules: ['mcp__Claude_Code_iOS_Simulator'] },
  charts: { label: 'inline charts and diagrams', rules: ['mcp__visualize', 'mcp__ccd_session__read_widget_context'] },
  artifacts: { label: 'Artifacts (published pages)', rules: ['Artifact', 'ArtifactComments', 'ArtifactData'] },
  agents: { label: 'helper agents', rules: ['Agent', 'ListAgents'] },
  web: { label: 'web search and fetch', rules: ['WebSearch', 'WebFetch'] },
  background: { label: 'background task watching', rules: ['Monitor', 'TaskStop'] },
  terminal: { label: "the owner's Terminal panel", rules: ['mcp__terminal'] },
  files: { label: 'sending the owner file cards', rules: ['SendUserFile'] },
  chapters: { label: 'chapters and session hand-offs', rules: ['mcp__ccd_session__mark_chapter', 'mcp__ccd_session__hand_off_to_session', 'mcp__ccd_session__dismiss_task'] },
  settings: { label: "the app's settings", rules: ['mcp__ccd_settings'] },
  directory: { label: 'adding or changing folders', rules: ['mcp__ccd_directory'] },
  chrome: { label: 'Claude in Chrome', rules: ['mcp__claude-in-chrome'], unused: true },
  workflows: { label: 'Workflows (multi-agent scripts)', rules: ['Workflow'], unused: true },
  suggestions: { label: 'plugin and skill suggestions', rules: ['SearchPlugins', 'SuggestPluginInstall', 'SuggestSkills', 'ListPlugins', 'ListSkills', 'SearchSkills'], unused: true },
  loop: { label: '/loop wake-ups', rules: ['ScheduleWakeup'], unused: true },
  review: { label: '/code-review findings', rules: ['ReportFindings'], unused: true },
  scheduling: { label: 'scheduled tasks and cron', rules: ['mcp__scheduled-tasks', 'CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger'], unused: true },
  layout: { label: 'sidebar, window and pane layout', rules: ['mcp__ccd_sidebar', 'mcp__ccd_window', 'mcp__ccd_view'], unused: true },
  pr: { label: 'pull-request watching', rules: ['mcp__ccd_pr'], unused: true },
  connectors: { label: 'connectors and the MCP registry', rules: ['mcp__mcp-registry', 'mcp__ccd_connectors'], unused: true },
  cloud: { label: 'moving a chat to the cloud', rules: ['mcp__ccd_session__move_to_cloud'], unused: true },
  notebooks: { label: 'Jupyter notebooks', rules: ['NotebookEdit'], unused: true },
  design: { label: 'design files', rules: ['DesignSync'], unused: true },
  notifications: { label: 'push notifications', rules: ['PushNotification'], unused: true },
  planmode: { label: 'plan mode', rules: ['EnterPlanMode', 'ExitPlanMode'], unused: true },
  worktrees: { label: 'switching worktrees', rules: ['EnterWorktree', 'ExitWorktree'], unused: true },
}
// What chat-hub-core itself needs: never turned off.
export const REQUIRED = ['Bash', 'Read', 'Edit', 'Write', 'Skill', 'ToolSearch', 'AskUserQuestion', 'SendMessage',
  'mcp__ccd_session_mgmt', 'mcp__ccd_session__start_session', 'mcp__ccd_turn', 'mcp__ccd_host']
const required = r => REQUIRED.some(q => r === q || r.startsWith(`${q}__`))
const toolName = w => /^[A-Za-z][\w-]*$/.test(w)

export const TOOLS_USAGE = 'Type /chat-hub-core:tools to list them, /chat-hub-core:tools off artifacts ios (groups, their numbers like 4 or 13-27, or ' +
  'single tools; "off unused" for the rarely used extras) to turn them off, /chat-hub-core:tools on browser (or "on ' +
  'all") to turn them back on.'

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
const known = new Set(Object.values(GROUPS).flatMap(g => g.rules))

// One line per group, then single tools turned off outside the groups.
function list(deny) {
  const lines = Object.entries(GROUPS).map(([g, { label, rules }], i) => {
    const some = !isOff(deny, g) && rules.some(r => deny.includes(r))
    return `${String(i + 1).padStart(2)}. ${isOff(deny, g) ? 'off ' : some ? 'part' : 'on  '} ${g}: ${label} (${rules.join(', ')})`
  })
  const extra = deny.filter(r => toolName(r) && !known.has(r))
  if (extra.length) lines.push(`Also off: ${extra.join(', ')}`)
  lines.push(`Always on (chat-hub-core needs them): ${REQUIRED.join(', ')}`)
  return lines.join('\n')
}

const summary = deny => {
  const off = Object.keys(GROUPS).filter(g => isOff(deny, g))
  return `Off: ${off.length ? off.join(', ') : 'none'}.`
}

// Returns { ok, changed, text }. `dir` is the chat's folder.
export function toolsCommand(args = '', dir = process.cwd()) {
  const words = String(args).trim().split(/[\s,]+/).filter(Boolean)
  const f = settingsFile(dir)
  let s
  try { s = readSettings(f) } catch (e) { return { ok: false, changed: false, text: `Not changed: couldn't read ${f} (${e.message}).` } }
  const deny = Array.isArray(s.permissions?.deny) ? s.permissions.deny : []
  if (!words.length) return { ok: true, changed: false, text: `Tools for every chat in this project:\n${list(deny)}` }

  const mode = words.shift().toLowerCase()
  if (mode !== 'off' && mode !== 'on') return { ok: false, changed: false, text: `Not changed: didn't understand "${args.trim()}". ${TOOLS_USAGE}` }
  if (!words.length) return { ok: false, changed: false, text: `Not changed: name a group or tool. ${TOOLS_USAGE}` }
  const rules = []
  for (const w of words) {
    const g = w.toLowerCase()
    const n = /^(\d+)(?:-(\d+))?$/.exec(g), names = Object.keys(GROUPS)
    if (n) {
      const [a, b] = [Number(n[1]), Number(n[2] || n[1])]
      if (a < 1 || b > names.length || a > b) return { ok: false, changed: false, text: `Not changed: no group numbered ${w} (1–${names.length}). ${TOOLS_USAGE}` }
      for (let k = a; k <= b; k++) rules.push(...GROUPS[names[k - 1]].rules)
    } else if (g === 'all') rules.push(...Object.values(GROUPS).flatMap(x => x.rules))
    else if (g === 'unused') rules.push(...Object.values(GROUPS).filter(x => x.unused).flatMap(x => x.rules))
    else if (g in GROUPS) rules.push(...GROUPS[g].rules)
    else if (toolName(w)) rules.push(w)
    else return { ok: false, changed: false, text: `Not changed: "${w}" isn't a group or tool name. ${TOOLS_USAGE}` }
  }
  const needed = rules.filter(required)
  if (mode === 'off' && needed.length) {
    return { ok: false, changed: false, text: `Not changed: chat-hub-core needs ${[...new Set(needed)].join(', ')}, so it stays on.` }
  }

  const next = mode === 'off' ? [...deny, ...[...new Set(rules)].filter(r => !deny.includes(r))] : deny.filter(r => !rules.includes(r))
  if (next.length === deny.length && next.every((r, i) => r === deny[i])) return { ok: true, changed: false, text: `Nothing to change. ${summary(deny)}` }
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
    text: `Saved in .claude/settings.local.json (just you, never committed). ${summary(next)} New chats load the ` +
      'new set; restart an open chat for it to drop or get them.',
  }
}

if (isMain(import.meta.url)) {
  const r = toolsCommand(process.argv.slice(2).join(' '))
  console.log(r.text)
  process.exit(r.ok ? 0 : 1)
}
