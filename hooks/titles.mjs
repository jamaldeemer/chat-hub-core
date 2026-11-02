// The chat's own title, checked at the end of each turn. The desktop app keeps a chat's title in
// custom-title.json next to its transcript (<transcripts>/<session ID>/custom-title.json), and
// keeps it there across a clear. Outside the app there's no such file and nothing is checked.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function readTitle(input) {
  if (!input?.transcript_path || !input?.session_id) return ''
  try {
    const t = JSON.parse(readFileSync(join(dirname(input.transcript_path), input.session_id, 'custom-title.json'), 'utf8'))
    return typeof t.customTitle === 'string' ? t.customTitle : ''
  } catch { return '' }
}

const SYMBOLS = ['🙋', '⏳', '🔨', '❓', '🟢', '🚀', '🔴', '⚪', '✅']
const lead = new RegExp(`^(${SYMBOLS.join('|')})️?( *)`, 'u')
// Plain-R release tags: release-first "R26~ 8E" and code-first "(R7)".
const plainR = /(^|[\s(])R(\d+[~+]?)(?=[\s)])/u

// What's wrong with a title, as short sentences ([] when it's fine). Only titles that look like
// ours (a symbol, a tag or a " · ") are checked, so an app-made title in a new chat is left alone.
// workChat: a chat that isn't the hub; ⚪ is then only right on a talk chat (no ʀ tag).
export function titleProblems(title, { workChat = false } = {}) {
  if (!title) return []
  const m = title.match(lead)
  const tagged = /ʀ\d/u.test(title) || plainR.test(title)
  if (!m && !tagged && !title.includes(' · ')) return []
  const out = []
  if (!m) out.push('it has no status symbol: put yours first, then two spaces')
  else if (m[2].length !== 2) out.push(`it needs exactly two spaces after the symbol, not ${m[2].length}`)
  if (plainR.test(title)) out.push('its release tag has a plain R: write small-caps ʀ (U+0280)')
  if (m && m[1] === '⚪' && workChat && /[ʀR]\d/u.test(title)) {
    out.push('⚪ is only for talk chats and the hub: set the symbol for where you are now (🔨 working, ❓ waiting on an answer, 🙋 asking for an OK, …)')
  }
  return out
}

// The title with what the hook can fix by itself fixed: two spaces after the symbol, ʀ for R.
export function fixedTitle(title) {
  return title.replace(lead, (_, s) => `${s}  `).replace(new RegExp(plainR.source, 'gu'), '$1ʀ$2')
}

// The note that sends the chat back to fix its title, or '' when the title is fine.
export function titleNote(input, { workChat }) {
  const title = readTitle(input)
  const p = titleProblems(title, { workChat })
  if (!p.length) return ''
  const fix = fixedTitle(title)
  return `chat-hub-core title check: this chat's title is "${title}", and ${p.join('; ')}. ` +
    `Set it now (set_session_title with "self")${fix !== title ? `, e.g. "${fix}"` : ''}, keeping the rest exactly ` +
    '(the tag, code and name are the hub\'s). Then end your turn: don\'t repeat your last reply.'
}
