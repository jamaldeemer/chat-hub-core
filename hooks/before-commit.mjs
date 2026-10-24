// Before `git commit`: the project's own reminder (e.g. run its docs check, add tests).
import { readConfig, say } from './config.mjs'

const c = readConfig()
const done = c?.done?.length ? ` Definition of "done": ${c.done.join('; ')}.` : ''
const extra = c?.commitReminder ? ` ${c.commitReminder}` : ''
if (c) say('PreToolUse', `About to commit: make sure the owner OK'd this commit.${done}${extra}`)
