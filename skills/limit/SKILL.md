---
name: limit
description: Show or change the context limits for this project's chats - the hub's wrap-up limit and work chats' - from the next prompt on, no restart, or give one chat 25k more room until it's cleared. Use when the owner types /chat-hub-core:limit (e.g. "/chat-hub-core:limit 200k", "/chat-hub-core:limit work 100k", "/chat-hub-core:limit more", "/chat-hub-core:limit default") or asks to see or change the hub's max context.
---

# Context limits

The prompt hook has usually done it already: a "chat-hub-core /limit:"
note came with the owner's prompt. Tell the owner what it says in one
short reply and do nothing else for it.

If no such note came (the hook didn't run), run it yourself with the
owner's words after the command:
`node "${CLAUDE_PLUGIN_ROOT}/hooks/limit.mjs" <words>` (none to show the
limits) and tell the owner its one line. Only ever for the owner's own
`/chat-hub-core:limit`: never to lift a stop you're under. Past its
limit the hub can't run it at all (the guard refuses it); if the hook
didn't run then, tell the owner so.

- `/chat-hub-core:limit` shows both limits and where each comes from.
- `/chat-hub-core:limit 200k` (or `hub 200k`) sets the hub's (`trimAt`).
- `/chat-hub-core:limit work 100k` sets work chats' (`trimAtWork`);
  `work off` turns it off.
- `/chat-hub-core:limit default` goes back to the settings
  (`hub default` / `work default` for one).
- `/chat-hub-core:limit more` gives only the chat it's typed in 25k
  tokens past where it is now (`more 40k` for another size), until it's
  cleared. It needs the prompt hook (it works on that chat's session),
  so it can't be run by hand. If its note says you're under your limit
  now, stop wrapping up, carry on, and set your normal status again if
  your title's symbol is 🔄.

They're kept in git's shared folder (`.git/chat-hub/limits.json`, beside
the hub record), so every chat in every worktree uses them from its next
prompt; they override `.claude/chat-hub.json` and are never committed.
Without git they're written into `.claude/chat-hub.json`.

The hub's limit is a hard stop in two stages: at it, the hub can't start
chats or build releases; `hardStopAfter` (in the settings, default 20k)
past it, it can only read and write its notes until cleared. A new
limit above its context (or `off`), or `more`, lifts both at once.
