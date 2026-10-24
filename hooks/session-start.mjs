// At the start of every chat: tell Claude which chat-core rules apply here.
import { readConfig, say } from './config.mjs'

const c = readConfig()
if (!c) {
  say('SessionStart', 'The chat-core plugin is installed but this project is not set up. If the owner asks about chats, hubs or releases, suggest /chat-core:setup.')
} else {
  say(
    'SessionStart',
    `This project uses chat-core (level ${c.level}). Look up this chat's name. If it is or ends with "Session Manager", ` +
      'this chat is the hub: load the chat-core:session-manager skill now. Otherwise it is a work chat: ' +
      'load the chat-core:work-chat skill now. Settings: .claude/chat-core.json.',
  )
}
