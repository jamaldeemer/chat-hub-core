// Level 2: the CI state of chat branches, for the hub. node ci-status.mjs [branch ...]
// Run from the project. No branches given: every branch checked out in a worktree except
// main and the release preview. One line per branch:
//   <branch> <sha> CI passed | CI not passed yet | CI couldn't be asked | not pushed | N commit(s) not pushed
// "Pushed" is as last fetched (a chat's own push updates it). A clear kills a chat's own CI
// watcher, so the hub runs this on every wake while any chat shows 🚀, and tells each 🚀 chat
// whose head passed. Exits 0 unless it can't run at all.
import { execFileSync } from 'node:child_process'
import { ciState, loadConfig, pushState } from './config.mjs'

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null } }
const top = git('rev-parse', '--show-toplevel')
if (!top) { console.log('ci-status: run this from inside the project'); process.exit(1) }
const { cfg, error } = loadConfig(top)
if (error || !cfg) { console.log(`ci-status: ${error ? `.claude/chat-hub.json is broken (${error})` : 'no .claude/chat-hub.json'}`); process.exit(1) }
if ((cfg.level || 0) < 2) { console.log(`ci-status: level ${cfg.level || 0}, no CI to ask`); process.exit(0) }
if (!cfg.ci?.passed) { console.log('ci-status: no ci.passed command in the settings'); process.exit(1) }

const skip = [cfg.branches?.main || 'main', cfg.branches?.release || 'release']
let branches = process.argv.slice(2)
if (!branches.length) {
  branches = (git('worktree', 'list', '--porcelain') || '').split('\n')
    .map(l => l.match(/^branch refs\/heads\/(.*)$/)?.[1]).filter(b => b && !skip.includes(b))
}
if (!branches.length) console.log('ci-status: no chat branches checked out')
for (const b of branches) {
  const p = pushState(b, top)
  if (!p) { console.log(`${b} - no such branch`); continue }
  const sha = p.head.slice(0, 7)
  if (!p.remote) console.log(`${b} ${sha} not pushed`)
  else if (p.ahead) console.log(`${b} ${sha} ${p.ahead} commit(s) not pushed`)
  else {
    const ci = ciState(cfg, p.head, top)
    console.log(`${b} ${sha} ${ci === 'passed' ? 'CI passed' : ci === 'not' ? 'CI not passed yet' : "CI couldn't be asked"}`)
  }
}
