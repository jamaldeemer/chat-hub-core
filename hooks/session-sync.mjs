// A chat's session ID changes when the desktop app restarts its process mid-conversation, with no
// clear and often no start note to say so; its app address (`local_…`) stays. Every hook calls
// syncSession first, so whatever is kept by session ID follows the chat to its new one:
// - the hub record (and the user hub's, with split hubs): when this chat's app address is the hub's, its new session ID is recorded,
//   so the hooks (title check, /chat-hub-core:hub, limits) keep treating it as the hub;
// - any chat's extra room from /chat-hub-core:limit more (kept in its usage counts), and the
//   plugin-update notice it was already given, which a restart doesn't end.
// The last session ID seen for each app address is kept in git's shared folder
// (chat-hub/apps/<app address>). Quiet and cheap when nothing changed; never throws.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { hostApp, hubNotesFile, readHub, readUserHub, setHub, setUserHub } from './config.mjs'
import { readUsage, writeUsage } from './usage.mjs'

const safe = s => String(s).replace(/[^\w.-]/g, '_')

// Returns { hub, moved }: hub is true when this chat's new session ID was recorded as the hub's;
// moved is the session ID it had before, or ''. `clear`: a clear ends the extra room, so none is
// carried over (the start hook drops it too).
export function syncSession(session, { cfg, clear = false } = {}) {
  const out = { hub: false, moved: '' }
  const app = hostApp()
  if (!session || !app) return out
  try {
    const hub = readHub(cfg)
    if (hub.app && hub.app === app && hub.session !== session) {
      setHub({ session, app })
      out.hub = true
    }
    // Split hubs: the user hub's record follows it the same way.
    const u = readUserHub()
    if (u.app && u.app === app && u.session !== session) {
      setUserHub({ session, app })
      out.userHub = true
    }
  } catch {}
  try {
    const notes = hubNotesFile()
    if (!notes) return out
    const dir = notes.replace(/\/hub-notes\.md$/, '/apps'), f = `${dir}/${safe(app)}`
    const last = existsSync(f) ? readFileSync(f, 'utf8').trim() : ''
    if (last === session) return out
    mkdirSync(dir, { recursive: true })
    writeFileSync(f, session + '\n')
    if (!last) return out
    out.moved = last
    const was = readUsage(last)
    if (!clear && was.roomTo) {
      const now = readUsage(session)
      if (!now.roomTo) writeUsage(session, { ...now, roomTo: was.roomTo })
    }
    const rules = notes.replace(/\/hub-notes\.md$/, '/rules')
    if (existsSync(`${rules}/${safe(last)}`) && !existsSync(`${rules}/${safe(session)}`)) {
      copyFileSync(`${rules}/${safe(last)}`, `${rules}/${safe(session)}`)
    }
  } catch {}
  return out
}
