// Reads the project's chat-hub-core settings (.claude/chat-hub.json). Returns null when setup hasn't run.
import { readFileSync } from 'node:fs'

export function readConfig(dir = process.cwd()) {
  try {
    return JSON.parse(readFileSync(`${dir}/.claude/chat-hub.json`, 'utf8'))
  } catch {
    return null
  }
}

export function say(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }))
}
