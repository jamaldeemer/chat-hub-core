// Is a work chat's folder safe to close? node close-check.mjs <the chat's worktree>
// Prints one PASS/FAIL line per check and exits 1 if any fails. The hub runs it before
// marking a chat ✅; nothing here asks the chat, it looks at git itself.
//   all levels: nothing uncommitted.
//   level 1+:   on its own branch (not main); every commit pushed; merged into the release preview.
//   level 2:    CI passed on its newest commit; no fix of its still waiting for the owner's check.
// "Pushed" uses the remote branch as last fetched; the hub fetches first if in doubt.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadConfig } from './config.mjs'

const dir = resolve(process.argv[2] || '.')
const lines = []
let failed = false
const pass = msg => lines.push(`PASS ${msg}`)
const fail = msg => { lines.push(`FAIL ${msg}`); failed = true }
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const tryGit = (...a) => { try { return git(...a) } catch { return null } }

const { cfg, error } = loadConfig(dir)
if (error || !cfg) {
  console.log(`FAIL settings: ${error ? `.claude/chat-hub.json is broken (${error})` : `no .claude/chat-hub.json in ${dir}`}`)
  process.exit(1)
}
const level = cfg.level || 0
const main = cfg.branches?.main || 'main'
const release = cfg.branches?.release || 'release'

if (tryGit('rev-parse', '--is-inside-work-tree') !== 'true') {
  if (level >= 1) fail(`git: ${dir} isn't a git folder`)
  else pass('git: none (level 0)')
} else {
  const dirty = git('status', '--porcelain')
  dirty ? fail(`uncommitted: ${dirty.split('\n').length} file(s) changed or untracked`) : pass('uncommitted: nothing')

  if (level >= 1) {
    const branch = tryGit('rev-parse', '--abbrev-ref', 'HEAD')
    const head = git('rev-parse', 'HEAD')
    if (!branch || branch === 'HEAD') fail('branch: not on a branch (detached)')
    else if (branch === main) fail(`branch: on ${main}; a work chat has its own branch`)
    else {
      pass(`branch: ${branch}`)
      const upstream = tryGit('rev-parse', '--abbrev-ref', '@{u}')
      if (!upstream) fail('pushed: the branch has never been pushed')
      else {
        const ahead = Number(tryGit('rev-list', '--count', '@{u}..HEAD') || 0)
        ahead ? fail(`pushed: ${ahead} commit(s) not pushed to ${upstream}`) : pass(`pushed: all of it, to ${upstream}`)
      }
      if (tryGit('rev-parse', '--verify', '-q', release) === null) fail(`merged: no ${release} branch (the release preview) to check against`)
      else if (tryGit('merge-base', '--is-ancestor', head, release) === null) fail(`merged: ${head.slice(0, 7)} isn't in the release preview (${release}) yet`)
      else pass(`merged: in the release preview (${release})`)

      if (level >= 2) {
        const cmd = cfg.ci?.passed
        if (!cmd) fail('CI: no ci.passed command in the settings')
        else {
          let out = '', rc = 0
          try { out = execFileSync('sh', ['-c', cmd], { cwd: dir, encoding: 'utf8', env: { ...process.env, SHA: head }, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
          catch (e) { rc = e.status ?? 1; out = String(e.stdout || '').trim() }
          if (out === '1') pass(`CI: passed on ${head.slice(0, 7)}`)
          else if (out === '0' && rc === 0) fail(`CI: hasn't passed on ${head.slice(0, 7)}`)
          else fail(`CI: couldn't ask whether ${head.slice(0, 7)} passed (check ci.passed)`)
        }
        const toCheck = `${dir}/${cfg.fixes?.toCheck || '.claude/issues-to-check.md'}`
        const waiting = existsSync(toCheck) ? readFileSync(toCheck, 'utf8').split('\n').filter(l => /^- #\d+/.test(l)) : []
        // Closing would delete this folder and its list, letting those fixes reach main unchecked.
        waiting.length ? fail(`fixes: ${waiting.length} still waiting for the owner's check (${waiting.map(l => l.match(/#\d+/)[0]).join(', ')})`)
          : pass('fixes: none waiting')
      }
    }
  }
}
console.log(lines.join('\n'))
console.log(failed ? 'NOT READY to close.' : 'READY to close (if the report is complete and nothing waits on the owner).')
process.exit(failed ? 1 : 0)
