// Level 1+: before building a release, check that the picked branches ship only their own work.
//   node release-check.mjs <picked branch> ...
// A chat cut from the release preview (or one that merged it) carries every branch that was in
// the preview then. If one of those is left out of the release, its work would ship anyway inside
// the picked branch. Run from the project. One line per picked branch:
//   PASS <branch>: ships only its own work (and other picked branches')
//   CARRIES <branch>: N commit(s) of <other> (left out)
//   CARRIES <branch>: N commit(s) from no branch here: <subjects>
// then OK or CHECK. A branch's own work: the non-merge commits on its first-parent line since main
// (commits made in its folder; the preview's own commits are all merges, so they don't count).
// Exits 1 on CHECK or when it can't run.
import { execFileSync } from 'node:child_process'
import { loadConfig } from './config.mjs'

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
const list = (...a) => (git('rev-list', ...a) || '').split('\n').filter(Boolean)
const stop = msg => { console.log(`release-check: ${msg}`); process.exit(1) }
const top = git('rev-parse', '--show-toplevel')
if (!top) stop('run this from inside the project')
const { cfg, error } = loadConfig(top)
if (error || !cfg) stop(error ? `.claude/chat-hub.json is broken (${error})` : 'no .claude/chat-hub.json')
const main = cfg.branches?.main || 'main'
const release = cfg.branches?.release || 'release'
const picked = process.argv.slice(2)
if (!picked.length) stop('usage: node release-check.mjs <picked branch> ...')
for (const b of picked) if (!git('rev-parse', '--verify', '-q', `refs/heads/${b}`)) stop(`no branch ${b}`)
if (!git('rev-parse', '--verify', '-q', `refs/heads/${main}`)) stop(`no branch ${main}`)

const own = b => new Set(list('--first-parent', '--no-merges', `${main}..refs/heads/${b}`))
const ours = new Set(picked.flatMap(b => [...own(b)]))
// Every other local branch with work not on main: the ones left out.
const others = (git('for-each-ref', '--format=%(refname:short)', 'refs/heads') || '').split('\n')
  .filter(b => b && b !== main && b !== release && !picked.includes(b))
  .map(b => ({ b, own: own(b) })).filter(o => o.own.size)

let carries = false
for (const p of picked) {
  const extra = list('--no-merges', `${main}..refs/heads/${p}`).filter(c => !ours.has(c))
  if (!extra.length) { console.log(`PASS ${p}: ships only its own work${picked.length > 1 ? ' (and other picked branches\')' : ''}`); continue }
  carries = true
  let left = extra
  for (const o of others) {
    const n = left.filter(c => o.own.has(c)).length
    if (n) console.log(`CARRIES ${p}: ${n} commit(s) of ${o.b} (left out)`)
    left = left.filter(c => !o.own.has(c))
  }
  if (left.length) {
    const subj = left.slice(0, 3).map(c => git('log', '-1', '--format=%s', c)).join('; ')
    console.log(`CARRIES ${p}: ${left.length} commit(s) from no branch here: ${subj}${left.length > 3 ? '; …' : ''}`)
  }
}
console.log(carries
  ? `CHECK: left-out work would ship inside the branches above. Ask the owner: ship those branches too, leave the carrying branch out as well, or have its chat revert that work.`
  : `OK: the picked branches ship only their own work.`)
process.exit(carries ? 1 : 0)
