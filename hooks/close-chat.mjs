// Close a finished work chat in one step (level 1+): node close-chat.mjs <its branch>
// Run by the hub from the project, after the chat's wrap-up report is in. In order:
//   1. finds the chat's folder (the worktree that has the branch checked out). If the preview is
//      checked out, it must be in this folder (the hub's own) with no uncommitted changes there;
//      anywhere else stops here;
//   2. runs close-check.mjs on it, all but "merged" (stops here on any FAIL);
//   3. merges the branch into the release preview without a worktree (merge-tree + commit-tree);
//      a clash stops here, and the chat resolves it;
//   4. runs the `checks` command from the settings on a copy of the merge (no `checks`: the
//      commands in backticks in `done`, else a default found in the project, see defaultChecks).
//      Skipped when the merge adds nothing to the branch (same tree): the chat's own run covered it;
//   5. moves the preview to the merge only if the checks passed (in the hub's folder, a fast-forward
//      that updates its files too), then runs the full close check.
// Prints PASS/FAIL lines and one last READY or FAIL line; exits 1 on FAIL.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const branch = process.argv[2]
const out = []
const done = (ok, why) => {
  console.log(out.join('\n'))
  console.log(ok ? `READY to close ${branch} (if the report is complete and nothing waits on the owner).`
    : `FAIL: ${branch} can't close yet (${why}).`)
  process.exit(ok ? 0 : 1)
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const tryGit = (...a) => { try { return git(...a) } catch { return null } }
if (!branch) { console.log('Usage: node close-chat.mjs <branch>'); process.exit(1) }

const top = tryGit('rev-parse', '--show-toplevel')
if (!top) { out.push('FAIL git: run this from inside the project'); done(false, 'not in the project') }
const { cfg, error } = loadConfig(top)
if (error || !cfg) { out.push(`FAIL settings: ${error ? `.claude/chat-hub.json is broken (${error})` : 'no .claude/chat-hub.json'}`); done(false, 'settings') }
if ((cfg.level || 0) < 1) { out.push('FAIL level: below level 1 there is no release preview; run close-check.mjs <folder>'); done(false, 'level 0') }
const release = cfg.branches?.release || 'release'
const real = p => { try { return realpathSync(p) } catch { return p } }

// No `checks` in the settings: commands in backticks in `done` ("tests pass (`npm test`)"),
// else the project's usual scripts: lint, typecheck, test, build from package.json (with the
// package manager its lock file names), else tests/run.sh, else a Makefile's test target.
const defaultChecks = dir => {
  const fromDone = (cfg.done || []).flatMap(d => [...String(d).matchAll(/`([^`]+)`/g)].map(m => m[1]))
  if (fromDone.length) return { cmd: fromDone.join(' && '), from: 'the commands in `done`' }
  const at = f => existsSync(join(dir, f))
  if (at('package.json')) {
    let scripts = {}
    try { scripts = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts || {} } catch {}
    const pm = at('pnpm-lock.yaml') ? 'pnpm' : at('yarn.lock') ? 'yarn' : at('bun.lockb') || at('bun.lock') ? 'bun' : 'npm'
    const names = ['lint', 'typecheck', 'test', 'build'].filter(n => scripts[n])
    if (names.length) return { cmd: names.map(n => `${pm} run ${n}`).join(' && '), from: 'the default (package.json scripts)' }
  }
  if (at('tests/run.sh')) return { cmd: 'sh tests/run.sh', from: 'the default (tests/run.sh)' }
  if (at('Makefile') && /^test:/m.test(readFileSync(join(dir, 'Makefile'), 'utf8'))) return { cmd: 'make test', from: 'the default (make test)' }
  return null
}

// 1. The chat's folder, and where the preview is checked out: nowhere, or this folder (the hub's own),
// where it moves by a fast-forward. Anywhere else, moving it would leave that folder stale.
const trees = git('worktree', 'list', '--porcelain').split('\n\n').map(b => ({
  path: b.match(/^worktree (.*)$/m)?.[1], ref: b.match(/^branch (.*)$/m)?.[1],
}))
const folder = trees.find(t => t.ref === `refs/heads/${branch}`)?.path
if (!folder) { out.push(`FAIL folder: no worktree has ${branch} checked out`); done(false, 'no folder') }
out.push(`PASS folder: ${folder}`)
const releaseAt = trees.find(t => t.ref === `refs/heads/${release}`)?.path
const inHub = !!releaseAt && real(releaseAt) === real(top)
if (releaseAt && !inHub) { out.push(`FAIL preview: ${release} is checked out at ${releaseAt}; run this there, or check out another branch there`); done(false, 'preview checked out elsewhere') }
if (inHub) {
  const dirty = git('status', '--porcelain', '--untracked-files=no')
  if (dirty) { out.push(`FAIL preview: ${release} is checked out here with ${dirty.split('\n').length} uncommitted change(s); commit or undo them first`); done(false, 'preview folder not clean') }
  out.push(`PASS preview: ${release} is checked out here; it moves by a fast-forward`)
}

// 2. Everything but "merged".
const check = (...flags) => {
  try { return { ok: true, text: execFileSync('node', [join(here, 'close-check.mjs'), folder, ...flags], { encoding: 'utf8' }) } }
  catch (e) { return { ok: false, text: String(e.stdout || '') } }
}
const pre = check('--before-merge')
if (!pre.ok) { out.push(...pre.text.split('\n').filter(l => /^(PASS|FAIL) /.test(l))); done(false, 'its folder failed a check; tell the chat') }

// 3. Merge.
const head = git('rev-parse', `refs/heads/${branch}`)
const old = tryGit('rev-parse', '--verify', '-q', `refs/heads/${release}`)
if (!old) { out.push(`FAIL merge: no ${release} branch (the release preview)`); done(false, 'no preview') }
let merge = null
if (tryGit('merge-base', '--is-ancestor', head, old) !== null) out.push(`PASS merge: ${head.slice(0, 7)} is already in ${release}`)
else {
  let tree
  try { tree = git('merge-tree', '--write-tree', '--name-only', old, head) }
  catch (e) {
    const files = String(e.stdout || '').split('\n\n')[0].split('\n').slice(1).filter(Boolean)
    out.push(`FAIL merge: clashes with ${release} in ${files.join(', ') || 'some files'}; the chat merges ${release} and resolves it`)
    done(false, 'merge clash')
  }
  // 4. Checks, unless the merge leaves the branch's tree as it is.
  if (tree === git('rev-parse', `${head}^{tree}`)) out.push(`PASS checks: skipped, the merge adds nothing to ${branch} (the chat's own run covers it)`)
  else {
    const copy = mkdtempSync(join(tmpdir(), 'chat-hub-close-'))
    const stop = (line, why) => { rmSync(copy, { recursive: true, force: true }); out.push(line); done(false, why) }
    execFileSync('sh', ['-c', 'git archive "$1" | tar -x -C "$2"', 'sh', tree, copy], { stdio: 'ignore' })
    const fallback = cfg.checks ? null : defaultChecks(copy)
    const cmd = cfg.checks || fallback?.cmd
    if (!cmd) stop('FAIL checks: no `checks` command in the settings, none in backticks in `done`, and no default found; set `checks` in .claude/chat-hub.json', 'no checks command')
    const which = fallback ? ` (no \`checks\` in the settings; ran ${fallback.from}; set \`checks\` to choose)` : ''
    try {
      // Installed packages aren't in git: borrow the project's.
      if (existsSync(join(top, 'node_modules')) && !existsSync(join(copy, 'node_modules'))) symlinkSync(join(top, 'node_modules'), join(copy, 'node_modules'))
      execFileSync('sh', ['-c', cmd], { cwd: copy, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60 * 1000 })
      out.push(`PASS checks: \`${cmd}\` passed on the merge${which}`)
    } catch (e) {
      const tail = `${e.stdout || ''}${e.stderr || ''}`.trim().split('\n').slice(-15).join('\n')
      stop(`FAIL checks: \`${cmd}\` failed on the merge${e.signal ? ' (stopped after 15 minutes)' : ''}${which}; ${release} left as it was\n${tail}`, 'checks failed')
    }
    rmSync(copy, { recursive: true, force: true })
  }
  // 5. Move the preview (only if nobody moved it meanwhile).
  merge = git('commit-tree', tree, '-p', old, '-p', head, '-m', `Merge branch '${branch}' into ${release}`)
  // Checked out here: a fast-forward moves the branch and this folder's files together, and refuses
  // if the branch moved meanwhile or the files changed (git won't overwrite local changes).
  const moved = inHub ? tryGit('merge', '--ff-only', '-q', merge) : tryGit('update-ref', `refs/heads/${release}`, merge, old)
  if (moved === null) {
    out.push(inHub && git('rev-parse', 'HEAD') === old ? `FAIL merge: couldn't fast-forward ${release} here (a local change in the way, or the sandbox blocked a file); fix that, or have the owner run: git merge --ff-only ${merge}`
      : `FAIL merge: ${release} moved while checking; run this again`)
    done(false, 'preview moved')
  }
  out.push(`PASS merge: ${branch} merged into ${release} (${merge.slice(0, 7)})`)
}
const final = check()
out.push(...final.text.split('\n').filter(l => /^(PASS|FAIL) /.test(l)))
done(final.ok, 'its folder failed a check; tell the chat')
