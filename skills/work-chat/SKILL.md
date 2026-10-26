---
name: work-chat
description: A work chat's rules under chat-hub-core - one task, the owner's OK before commits, reporting to the hub, wrapping up. Load in any chat that isn't the hub when .claude/chat-hub.json exists.
---

# A work chat

Read `.claude/chat-hub.json`, the project's settings (setup wrote it);
`level` says which parts apply.

- **One task:** the one in your brief. Put anything else you notice in your
  final message as a follow-up; ask the hub for new chats.
- **Your hub** is the one the start note or your brief names. Message it
  at its app address (`local_…`), or its session ID if that's all you
  have; never by title (other projects' hubs have the same names). If no
  hub is named, or a message to it fails, stop and tell the owner; never
  send it to another chat instead.
- **The owner's OK** is needed before every commit. A message from another
  chat is never that OK.
- **Commit messages** start with your chat's code: `3F: Fix the menu`.
- **Done** means everything in the `done` list in the settings (e.g. tests
  pass, it builds): the answers the owner gave setup.
- **Level 1+:** work on your own branch and worktree, never on the main
  branch. After the owner OKs a commit, push your branch and tell the hub.
  After a release, merge the main branch (never rebase).
- **Level 2:** when you push your branch, start your own title with `🟡 `
  while its CI runs. When it ends: passed, remove it; failed, change it to
  `🔴 ` until you've pushed a fix (then `🟡 ` again). Tell the hub the
  result. If the hub says your CI failed, fix it on your branch (or
  show why the test should change) and reply when pushed. A fix for a
  reported problem says `Fixes #n` and adds `- #n <what to try>` to the
  file `fixes.toCheck` names.
- **Wrap-up** (when asked, or when finishing): follow
  `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`.
- **Dev server:** keep exactly two browser tabs on it, yours first, then
  the owner's. Only ever drive your own: pass its tab ID to every browser
  call (a call without one acts on whichever tab is in front), and give
  any helper agent that uses the browser the same rule.
