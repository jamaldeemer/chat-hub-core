---
name: version
description: Show which chat-hub-core version this project runs, whether a newer one is out, and how to update. Use when the owner types /chat-hub-core:version or asks which chat-hub-core version a project has.
---

# Version

The prompt hook has usually done it already: a "chat-hub-core /version:"
note came with the owner's prompt. Tell the owner what it says in one
short reply and do nothing else for it.

If no such note came (the hook didn't run), run
`node "${CLAUDE_PLUGIN_ROOT}/hooks/version.mjs"` and tell the owner its
one line.

It reads this project's install from Claude's `installed_plugins.json`,
and the newest release from the highest `v*` tag on GitHub (or the
marketplace copy if GitHub can't be reached). To update every project:
`sh ~/.claude/plugins/marketplaces/chat-hub/scripts/update-all.sh`.
