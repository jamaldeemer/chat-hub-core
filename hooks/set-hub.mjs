// Record this project's hub: node set-hub.mjs --session <session ID> --app <local_… address>
// Either flag alone works: --app adds the app address to the current hub; --session replaces it.
// A bare ID (no flag) is read as a session ID, or an app address if it starts with local_.
// Taking over from another hub needs --replace.
import { HubTaken, hubAddress, readHub, setHub } from './config.mjs'

const a = process.argv.slice(2)
const flag = name => { const i = a.indexOf(name); return i >= 0 ? (a[i + 1] || '') : '' }
let session = flag('--session'), app = flag('--app')
if (!session && !app && a[0]) (a[0].startsWith('local_') ? (app = a[0]) : (session = a[0]))
if (!session && !app) { console.error('usage: node set-hub.mjs --session <id> [--app <local_…>]'); process.exit(2) }
let old
try { old = setHub({ session, app, replace: a.includes('--replace') }) }
catch (e) {
  if (!(e instanceof HubTaken)) throw e
  console.error(`Not recorded: ${e.message}. If that chat is closed, or the owner wants to switch, add --replace.`)
  process.exit(1)
}
const h = readHub()
console.log(`Hub is now ${hubAddress(h)}${h.app && h.session ? ` (session ${h.session})` : ''}.` + (old ? ` It replaced ${old}.` : ''))
