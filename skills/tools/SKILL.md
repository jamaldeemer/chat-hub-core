---
name: tools
description: Show or change which heavy tools this project's chats load (Browser pane, iOS simulator, charts, Artifacts...), to cut every chat's context. Use when the owner types /chat-hub-core:tools (e.g. "/chat-hub-core:tools off browser ios", "/chat-hub-core:tools on all") or asks to turn tools off or on for this project.
---

# Tools

The prompt hook has usually done it already: a "chat-hub-core /tools:"
note came with the owner's prompt. Tell the owner what it says in one
short reply and do nothing else for it.

If no such note came (the hook didn't run), run it yourself with the
owner's words after the command:
`node "${CLAUDE_PLUGIN_ROOT}/hooks/tools.mjs" <words>` (none to show what's
off) and tell the owner its line. If your sandbox blocks the write, give
the owner the command to type instead: `/chat-hub-core:tools <words>`.

- `/chat-hub-core:tools` shows which groups are off and on.
- `/chat-hub-core:tools off browser ios` turns groups off; `off unused`
  turns off every group.
- `/chat-hub-core:tools on browser` turns them back on; `on all` for
  every group.

Groups: `browser` (Browser pane), `chrome` (Claude in Chrome), `ios` (iOS
simulator), `charts` (inline charts and diagrams), `artifacts` (published
pages), `workflows` (multi-agent scripts), `suggestions` (plugin and skill
suggestions).

It writes deny rules in the project's `.claude/settings.local.json` (just
the owner, never committed), which remove those tools from every chat,
hub and work chats alike. New chats load the new set; an open chat drops
or gets them when restarted. A work chat that needs a tool that's off
(e.g. the Browser pane for a UI fix) asks the owner to turn it on.
