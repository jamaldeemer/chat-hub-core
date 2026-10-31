// Hard stops for rules that used to depend on a chat remembering them. Runs before a chat's
// shell commands, file edits and (for the hub past its hard stop) every tool. Refuses (with the reason) when, at level 1+:
//   - a chat commits on the main branch (the hub is exempt: releases are its job),
//   - anyone rebases,
//   - a work chat edits a file in another chat's worktree;
// and, at any level, when a work chat's commit message doesn't start with a chat code.
import { execFileSync } from 'node:child_process'
import { realpathSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { hookInput, hubNotesFile, readConfig, readHub, say } from './config.mjs'
import { hardStopText, hardStopped, readUsage, trimLimits, trimNudge } from './usage.mjs'

const input = hookInput()
const cwd = input.cwd || process.cwd()
const c = readConfig(cwd)
if (!c) process.exit(0)
const level = c.level || 0
const main = c.branches?.main || 'main'
const hub = readHub(c)
const isHub = !!(hub.session && input.session_id === hub.session)

const deny = reason => {
  writeSync(1, JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `chat-hub-core: ${reason}`,
  } }))
  process.exit(0)
}
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const tryGit = (dir, ...a) => { try { return git(dir, ...a) } catch { return '' } }
const expand = p => resolve(cwd, p.replace(/^~(?=\/|$)/, homedir()))
// The real path (macOS has /var and /private/var for the same folder); the file may not exist yet.
const real = p => { try { return realpathSync(p) } catch { try { return resolve(realpathSync(dirname(p)), basename(p)) } catch { return p } } }

const tool = input.tool_name || ''
const ti = input.tool_input || {}


// Past the hub's hard stop (trimHardStop), refuse everything but saving its notes: reading,
// read-only shell commands, and edits to hub-notes.md. The owner clearing the chat lifts it.
if (isHub && hardStopped({ session: input.session_id, isHub, cfg: c })) {
  const notes = hubNotesFile()
  const file = ti.file_path || ti.notebook_path
  const readOnlyCmd = cmd => !/[;&>`]|\$\(|\bsed\s+-i|\btee\b/.test(cmd) &&
    cmd.split('|').every(p => /^\s*(cat|head|tail|sed -n|grep|ls|wc|pwd|date|git (status|log|diff|show|branch|rev-parse|worktree list))\b/.test(p))
  const ok = /^(Read|Grep|Glob|ToolSearch|mcp__ccd_turn__.*)$/.test(tool) ||
    (/^(Edit|Write|MultiEdit)$/.test(tool) && notes && file && real(expand(file)) === real(notes)) ||
    (tool === 'Bash' && readOnlyCmd(String(ti.command || '')))
  if (!ok) {
    deny(hardStopText(readUsage(input.session_id).context, trimLimits(true, c).hard) +
      (notes ? ` Your notes file: ${notes}` : ''))
  }
}

if (tool === 'Bash') {
  const cmd = String(ti.command || '')
  // Where the command runs: a leading `cd <dir> &&` or `git -C <dir>`, else the chat's folder.
  const cdTo = cmd.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)
  const gitC = cmd.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)
  const dirArg = (gitC || cdTo)?.[1]?.replace(/^["']|["']$/g, '')
  const dir = dirArg ? expand(dirArg) : cwd
  const gitVerb = v => new RegExp(`\\bgit\\s+(?:-C\\s+\\S+\\s+)?${v}\\b`).test(cmd)

  if (level >= 1 && (gitVerb('rebase') || /\bgit\s+(?:-C\s+\S+\s+)?pull\b[^&|;]*--rebase/.test(cmd))) {
    deny('never rebase. Merge the main branch instead (`git merge ' + main + '`).')
  }

  if (gitVerb('commit')) {
    if (level >= 1 && !isHub) {
      const branch = tryGit(dir, 'rev-parse', '--abbrev-ref', 'HEAD')
      const hasCommits = !!tryGit(dir, 'rev-parse', '--verify', '-q', 'HEAD')
      if (branch === main && hasCommits) {
        deny(`never commit on ${main}. Work on your own branch and worktree; the hub brings it to ${main} in a release.`)
      }
    }
    if (!isHub) {
      // The commit message's first line, from -m "…", -m '…' or -m "$(cat <<'EOF' … EOF)".
      let msg = null
      const heredoc = cmd.match(/(?:-m|--message)[=\s]+"\$\(cat\s+<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1/)
      const quoted = cmd.match(/(?:-m|--message)[=\s]+("([^"\\]|\\.)*"|'[^']*')/)
      if (heredoc) msg = heredoc[2]
      else if (quoted) msg = quoted[1].slice(1, -1)
      const first = msg?.split('\n').find(l => l.trim())?.trim()
      // Codes: today's two characters (A2, 3F) or a project's older letter+two-digit style (L76).
      const coded = /^([ACEF][2-9]|[2-9][ACEF]|[A-Z]\d{2}):\s/.test(first || '')
      if (first && !coded && !/^Merge\b/.test(first)) {
        deny('start the commit message with your chat code and a colon, e.g. "3F: Fix the menu". ' +
          'No code yet (a chat the hub didn\'t start)? Ask the hub for one.')
      }
    }
  }
}

if (level >= 1 && !isHub && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
  const file = ti.file_path || ti.notebook_path
  if (file) {
    const path = real(expand(file))
    const own = real(tryGit(cwd, 'rev-parse', '--show-toplevel'))
    const roots = tryGit(cwd, 'worktree', 'list', '--porcelain').split('\n')
      .filter(l => l.startsWith('worktree ')).map(l => real(l.slice(9)))
    // The worktree a file belongs to is the deepest one containing it (worktrees can be nested).
    const owner = roots.filter(r => path === r || path.startsWith(r + '/')).sort((a, b) => b.length - a.length)[0]
    if (own && owner && owner !== own) {
      deny(`${file} is in another chat's folder (${owner}). Only edit files in your own worktree (${own}); ` +
        'ask the hub if that chat needs a change.')
    }
  }
}

// Nothing refused: pass on a trim nudge if this chat just crossed its size limit.
const nudge = trimNudge({ session: input.session_id, isHub, cfg: c })
if (nudge) say('PreToolUse', nudge)
