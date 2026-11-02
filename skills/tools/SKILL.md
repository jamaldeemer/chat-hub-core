---
name: tools
description: Show or change which tools this project's chats load (Browser pane, iOS simulator, charts, Artifacts, any tool), to cut every chat's context. Use when the owner types /chat-hub-core:tools (e.g. "/chat-hub-core:tools off 4 13-27", "/chat-hub-core:tools on browser") or asks to turn tools off or on for this project.
---

# Tools

The prompt hook has usually done it already: a "chat-hub-core /tools:"
note came with the owner's prompt. Tell the owner what it says (show the
list as it is, numbered) and do nothing else for it.

If no such note came (the hook didn't run), run it yourself with the
owner's words after the command:
`node "${CLAUDE_PLUGIN_ROOT}/hooks/tools.mjs" <words>` and show the owner
what it prints. If your sandbox blocks the write, give the owner the
command to type instead: `/chat-hub-core:tools <words>`.

- `/chat-hub-core:tools` lists every tool group, numbered, on or off.
- `/chat-hub-core:tools off 4 13-27` turns groups off by number, or by
  name (`off artifacts ios`), or single tools (`off SendUserFile`);
  `off unused` turns off the rarely used extras.
- `/chat-hub-core:tools on browser` turns them back on; `on all` for
  every group.

Off by default in every project: `ios` (2), `artifacts` (4) and the
rarely used extras (13–27). The start and prompt hooks turn each off
once and record it; one the owner turns back on stays on.

The tools chat-hub-core needs (Bash, Read, Edit, Write, Skill,
ToolSearch, AskUserQuestion, SendMessage, the app's session, task-list
and host tools) always stay on.

It writes deny rules in the project's `.claude/settings.local.json` (just
the owner, never committed), which remove those tools from every chat,
hub and work chats alike. New chats load the new set; an open chat drops
or gets them when restarted. A chat can't see an off tool, so its start
note names what's off in one line; a chat that needs one (e.g. the
Browser pane for a UI fix) asks the owner to type
`/chat-hub-core:tools on <name>`.
