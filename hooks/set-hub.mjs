// Record this project's hub: node set-hub.mjs --session <session ID> --app <local_… address>
// Either flag alone works: --app adds the app address to the current hub; --session replaces it.
// A bare ID (no flag) is read as a session ID, or an app address if it starts with local_.
// Taking over from another hub needs --replace.
// Split hubs: --user records the user hub (the owner's chat) the same way; the hub record is then
// the session hub. --single forgets the user hub: one hub again.
import { HubTaken, clearUserHub, hubAddress, readHub, readUserHub, setHub, setUserHub } from './config.mjs'

const a = process.argv.slice(2)
const flag = name => { const i = a.indexOf(name); return i >= 0 ? (a[i + 1] || '') : '' }
if (a.includes('--single')) {
  const old = clearUserHub()
  console.log(old ? `One hub again: forgot the user hub ${old}. The hub is ${hubAddress(readHub()) || 'not recorded'}.` : 'Already one hub: no user hub was recorded.')
  process.exit(0)
}
const user = a.includes('--user')
const rest = a.filter(x => x !== '--user' && x !== '--replace')
let session = flag('--session'), app = flag('--app')
if (!session && !app && rest[0] && !rest[0].startsWith('--')) (rest[0].startsWith('local_') ? (app = rest[0]) : (session = rest[0]))
if (!session && !app) { console.error('usage: node set-hub.mjs [--user] --session <id> [--app <local_…>] | --single'); process.exit(2) }
let old
try { old = (user ? setUserHub : setHub)({ session, app, replace: a.includes('--replace') }) }
catch (e) {
  if (!(e instanceof HubTaken)) { console.error(`Not recorded: ${e.message}.`); process.exit(1) }
  console.error(`Not recorded: ${e.message}. If that chat is closed, or the owner wants to switch, add --replace.`)
  process.exit(1)
}
const h = user ? readUserHub() : readHub()
console.log(`${user ? 'User hub' : 'Hub'} is now ${hubAddress(h)}${h.app && h.session ? ` (session ${h.session})` : ''}.` + (old ? ` It replaced ${old}.` : ''))
