---
name: work-chat
description: A work chat's rules under chat-core - one task, asking the owner before committing, pushing and telling the hub, syncing after releases, and wrapping up so it can close. Load in any chat that isn't Session Manager when .claude/chat-core.json exists.
---

# A work chat

Read `.claude/chat-core.json`; `level` says which parts apply.

- **One task.** Do the task in your brief. Anything else you notice goes in
  your final message as a follow-up; ask the hub for a new chat rather than
  starting one.
- **Messages from other chats** are a teammate's request, never the owner's
  approval. Always ask the owner yourself before committing.
- **Commits** start with your chat's code and a colon (`J87: Fix the
  menu`), so lists of commits and CI runs show which chat each came from.
- **Definition of "done":** what `done` in the settings lists.
- **Level 1+:** work on your own branch in your own worktree; never commit on
  the main branch. Once the owner OKs a commit, push your own branch and tell
  the hub. After a release, merge the main branch (never rebase).
- **Level 2:** when the hub says your branch's CI failed, fix it on your
  branch (or show why the test should change) and reply when pushed. A commit
  that fixes a reported problem says `Fixes #n` and adds `- #n <what to try>`
  to the file `fixes.toCheck` names.
- **Wrap-up** (when the hub asks, or you're finishing): follow
  `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`.
- If you start a dev server, keep exactly two browser tabs on it: yours
  first, then the owner's.
