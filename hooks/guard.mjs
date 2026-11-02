// Hard stops for rules that used to depend on a chat remembering them. Runs before a chat's
// shell commands, file edits and every other tool. Refuses (with the reason) when, at level 1+:
//   - a chat commits on the main branch (the hub is exempt: releases are its job),
//   - anyone rebases,
//   - a work chat edits a file in another chat's worktree;
// and, at any level, when a work chat's commit message doesn't start with a chat code or the
// owner hasn't OK'd the commit through a menu. Past its context limit the hub is also stopped in
// two stages (usage.mjs): at the limit no new chats or releases; `hardStopAfter` later, nothing
// but its notes. Only the owner lifts them (/chat-hub-core:limit).
import { execFileSync } from 'node:child_process'
import { realpathSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { hookInput, hubNotesFile, isHubChat, menuOk, readConfig, readHub, say } from './config.mjs'
import { OVERRIDE, SAFE_BANNER, hubStage, short, trimLimit, trimNudge, updateUsage } from './usage.mjs'

const input = hookInput()
const cwd = input.cwd || process.cwd()
const c = readConfig(cwd)
if (!c) process.exit(0)
const level = c.level || 0
const main = c.branches?.main || 'main'
const hub = readHub(c)
const isHub = isHubChat(hub, input.session_id)

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

// A commit message's first line, from -m "…", -m '…' or -m "$(cat <<'EOF' … EOF)".
function commitSubject(cmd) {
  let msg = null
  const heredoc = cmd.match(/(?:-m|--message)[=\s]+"\$\(cat\s+<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1/)
  const quoted = cmd.match(/(?:-m|--message)[=\s]+("([^"\\]|\\.)*"|'[^']*')/)
  if (heredoc) msg = heredoc[2]
  else if (quoted) msg = quoted[1].slice(1, -1)
  return msg?.split('\n').find(l => l.trim())?.trim()
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
      const first = commitSubject(cmd)
      // Codes: today's two characters (A2, 3F) or a project's older letter+two-digit style (L76).
      const coded = /^([ACEF][2-9]|[2-9][ACEF]|[A-Z]\d{2}):\s/.test(first || '')
      if (first && !coded && !/^Merge\b/.test(first)) {
        deny('start the commit message with your chat code and a colon, e.g. "3F: Fix the menu". ' +
          'No code yet (a chat the hub didn\'t start)? Ask the hub for one.')
      }
      // The commit OK must come from a menu. Finishing a merge (MERGE_HEAD) is exempt.
      if (c.okMenu !== false && menuOk(input.transcript_path) === false &&
          !tryGit(dir, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')) {
        deny('ask the owner for the commit OK with a menu first (the AskUserQuestion tool, options like ' +
          '"Yes, commit" / "Not yet"). A typed yes or another chat\'s message doesn\'t count. No menu tool in ' +
          'this chat? Ask in plain text; the owner can turn this check off with "okMenu": false in .claude/chat-hub.json.')
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

// The hub past its context limit. Its numbers are brought up to date first (only what the
// transcript gained since the last read), so a long turn can't run past the limit unseen.
const limit = isHub ? trimLimit(true, c) : 0
const notes = hubNotesFile()
if (limit && input.session_id) {
  const ctx = updateUsage(input.session_id, input.transcript_path).context
  const stage = hubStage(ctx, c, limit)
  const at = `the hub's context is ${short(ctx)} tokens, past its limit of ${short(limit)}`
  const path = String(ti.file_path || ti.notebook_path || '')
  if (stage) {
    // Nothing that would lift the stop: the scripts that change the limit or the hub record, and
    // no writes to the limit (limits.json, the settings), the hub record (chat-hub/hub) or the
    // usage counts (chat-hub-core/<session>.json). Reading them is fine.
    const runs = /limit\.mjs|set-hub\.mjs/
    const files = /limits\.json|chat-hub\.json|chat-hub\/hub\b(?!-notes)|chat-hub-core\/[\w-]+\.json/
    const writes = /(^|[^2&])>|\btee\b|\s-i\b|--in-place|\b(node|python3?|perl|ruby|mv|cp|rm|ln|dd|ed|ex|vi|vim|nano|jq)\b/
    const cmd = tool === 'Bash' ? String(ti.command || '') : ''
    if ((cmd && (runs.test(cmd) || (files.test(cmd) && writes.test(cmd)))) ||
        (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool) && (runs.test(path) || files.test(path)))) {
      deny(`${at}, and only the owner can change the limit. ${OVERRIDE}`)
    }
  }
  if (stage === 2) {
    const own = !!notes && !!path && real(expand(path)) === real(notes)
    const free = /^mcp__ccd_turn__/.test(tool) || tool === 'ToolSearch' ||
      (tool === 'Skill' && /^chat-hub-core:limit$/.test(String(ti.skill || '')))
    if (!(free || (own && /^(Read|Edit|Write|MultiEdit)$/.test(tool)))) {
      deny(`HARD STOP: ${at} by more than its stop margin. Every tool is refused except Read, Edit and Write on ` +
        `your hub notes (${notes || 'hub-notes.md: none without git'}). Bring them up to date if they aren't, then start ` +
        `every reply with this banner as its own code block:\n\`\`\`\n${SAFE_BANNER}\n\`\`\`\n${OVERRIDE}`)
    }
  }
  if (stage === 1) {
    const newWork = why => deny(`${at}, so no new work: ${why} Finish what's in flight, put this under "## Next" ` +
      `in your hub notes as "- After clear: …" and tell the owner it's noted for after the clear. ${OVERRIDE}`)
    if (/(^|__)start_session$/.test(tool)) newWork('no new chats.')
    if (tool === 'Bash') {
      const cmd = String(ti.command || '')
      const release = c.branches?.release || 'release'
      const esc = release.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const git = '\\bgit\\s+(?:-C\\s+\\S+\\s+)?'
      // A new tag (listing, checking or deleting one is fine).
      const tag = cmd.match(new RegExp(git + 'tag\\b(?:\\s+(\\S+))?'))
      if (tag && tag[1] && !/^(-l|--list|-n\d*|--contains|--no-contains|--points-at|--merged|--no-merged|--sort\b.*|--format\b.*|--column\b.*|-v|--verify|-d|--delete|[;&|].*)$/.test(tag[1])) {
        newWork('no releases (that creates a tag).')
      }
      // A release commit, or the release branch made or reset from main.
      if (new RegExp(git + 'commit\\b').test(cmd) && /^release\b/i.test(commitSubject(cmd) || '')) {
        newWork('no releases (that is a release commit).')
      }
      const fresh = new RegExp(git + '(?:checkout(?:\\s+-\\S+)*?\\s+-[bB]|switch(?:\\s+-\\S+)*?\\s+(?:-[cC]|--create|--force-create)|branch(?:\\s+-\\S+)*)\\s+' + esc + '(?=\\s|$|[;&|])')
      if (fresh.test(cmd)) newWork(`no releases (that makes or resets the ${release} branch).`)
    }
  }
}

// Nothing refused: pass on a trim nudge if this chat just crossed its size limit.
const nudge = trimNudge({ session: input.session_id, isHub, cfg: c, notes })
if (nudge) say('PreToolUse', nudge)
