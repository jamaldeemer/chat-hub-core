// Level 2: the hub's CI watcher. node ci-watch.mjs [--every 60] [--for 60]
// The hub starts it in the background (never in the foreground) while any chat shows 🚀. It asks
// CI about every 🚀 chat's head once a minute, outside the hub's context, and exits, which wakes
// the hub, only when there's something to do:
//   - a 🚀 chat's head passed CI (once per commit; the prompt hook won't repeat it);
//   - no chat shows 🚀 any more (nothing left to watch);
//   - --for minutes went by with 🚀 chats still not passed (look for a failure, or start it again).
// ci.passed can't tell a failed run from a running one, so a failure shows up only as the last.
import { loadConfig } from './config.mjs'
import { newlyPassed, passedLine, rocketChats } from './books.mjs'

const arg = (name, d) => { const i = process.argv.indexOf(name), v = Number(process.argv[i + 1]); return i > 0 && Number.isFinite(v) ? v : d }
const every = arg('--every', 60) * 1000
const until = Date.now() + arg('--for', 60) * 60 * 1000
const { cfg } = loadConfig(process.cwd())
if (!cfg || (cfg.level || 0) < 2 || !cfg.ci?.passed) {
  console.log(`ci-watch: ${!cfg ? 'no .claude/chat-hub.json here' : (cfg.level || 0) < 2 ? `level ${cfg.level || 0}, no CI to watch` : 'no ci.passed command in the settings'}`)
  process.exit(0)
}
const session = process.env.CHAT_HUB_SESSION || ''
for (;;) {
  const rockets = rocketChats({ cfg, session })
  const fresh = newlyPassed(rockets)
  if (fresh.length) { console.log(passedLine(fresh)); process.exit(0) }
  if (!rockets.length) { console.log('ci-watch: no chat shows 🚀; nothing left to watch.'); process.exit(0) }
  const waiting = rockets.filter(r => r.ci !== 'passed')
  if (!waiting.length && Date.now() >= until) { console.log('ci-watch: every 🚀 chat passed and was named already.'); process.exit(0) }
  if (Date.now() >= until) {
    console.log(`ci-watch: still not passed: ${waiting.map(r => `${r.code} ${r.sha} (${r.ci === 'unpushed' ? 'not pushed' : r.ci === 'not' ? 'not passed yet' : "couldn't ask"})`).join(', ')}. ` +
      'Look for a failed run; start the watcher again if they are still running.')
    process.exit(0)
  }
  await new Promise(r => setTimeout(r, every))
}
