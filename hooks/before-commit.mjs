// Before `git commit`: the project's own reminder (e.g. run its docs check, add tests).
// hooks.json's `if` should limit this to commits, but it has fired on every command, so check here too.
import { hookInput, readConfig, say } from './config.mjs'

const input = hookInput()
const cmd = String(input.tool_input?.command || '')
if (!/\bgit\s+(?:-C\s+\S+\s+)?commit\b/.test(cmd)) process.exit(0)
const c = readConfig(input.cwd || process.cwd())
const done = c?.done?.length ? ` Done means: ${c.done.join('; ')}.` : ''
const extra = c?.commitReminder ? ` ${c.commitReminder}` : ''
if (c) say('PreToolUse', `Before committing: the owner must have OK'd this commit.${done}${extra}`)
