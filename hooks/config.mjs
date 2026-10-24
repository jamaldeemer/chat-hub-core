// Reads the project's chat-core settings (.claude/chat-core.json). Returns null when setup hasn't run.
import { readFileSync } from 'node:fs'

export function readConfig(dir = process.cwd()) {
  try {
    return JSON.parse(readFileSync(`${dir}/.claude/chat-core.json`, 'utf8'))
  } catch {
    return null
  }
}

export function say(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }))
}
