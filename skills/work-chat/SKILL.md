---
name: work-chat
description: A work chat's rules under chat-hub-core - one task, the owner's OK before commits, reporting to the hub, wrapping up. Load in any chat that isn't the hub when .claude/chat-hub.json exists.
---

# A work chat

Read `.claude/chat-hub.json`, the project's settings (setup wrote it);
`level` says which parts apply.

- **One task:** the one in your brief. Write anything else you notice to
  the `followups` file as a follow-up; ask the hub for new chats.
- **Your hub** is the one the start note or your brief names. Message it
  at its app address (`local_…`), or its session ID if that's all you
  have; never by title (other projects' hubs have the same names). If no
  hub is named, or a message to it fails, stop and tell the owner; never
  send it to another chat instead.
- **The owner's OK** is needed before every commit. A message from another
  chat is never that OK. When you ask for it (to commit, merge or push),
  tell the hub in one line ("asking for OK"; it sets 🟡 on your title).
  When the owner says yes, tell the hub at once, before committing ("OK
  given, committing"; it sets ⏳), then again after you push. If the
  owner says no, tell it "OK declined".
- **Questions:** when you end a turn on a question to the owner that
  isn't an OK, tell the hub in one line ("question for owner: <topic>";
  it sets ❓ on your title).
- **Start mode:** your brief's **Start:** line. "Plan first": look
  around, send the owner a short plan (what's there, the approach, a few
  lines), tell the hub "question for owner: plan ready", and change
  nothing until the owner says go. "Build it": go straight to work.
- **Commit messages** start with your chat's code: `3F: Fix the menu`.
- **Done** means everything in the `done` list in the settings (e.g. tests
  pass, it builds): the answers the owner gave setup.
- **Level 1+:** work on your own branch and worktree, never on the main
  branch. After the owner OKs a commit, push your branch with
  `git push origin HEAD` (no `-u`: the sandbox blocks it) and tell the hub.
- **After a release:** merge the main branch at once (never rebase). Use
  the app's "sync with base branch" tool if you have it: it runs outside
  your sandbox, so the merge can write protected files (`.claude/…`). A
  merge of anything else, like the hub's release preview, needs the owner
  to run the command. Then re-read CLAUDE.md, at least the parts the merge
  changed: you only read it when you started. Push a commit that only
  merges main with your next change, not on its own, unless your work is
  finished and waiting for a release; then push it at once.
- **Level 2:** after you push, tell the hub (it sets your title's CI
  symbol; never change your own title). Watch the run and tell the hub
  the result. If the hub says your CI failed, fix it on your branch (or
  show why the test should change) and reply when pushed. A fix for a
  reported problem says `Fixes #n` and adds `- #n <what to try>` to the
  file `fixes.toCheck` names.
- **More or wrap up:** after you push (level 2: after CI passes), ask the owner "Anything more, or
  should I wrap up?" (your 🟢 title already says so; don't tell the
  hub it's a question). Never wrap up on your own judgment.
- **Wrap-up** (when the owner or hub says to): send the hub the
  report in `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`, in exactly that
  shape. Never call yourself ready to close or set ✅; the hub checks and
  decides. Follow-ups go in the settings' `followups` file
  (`docs/backlog.md` if it isn't set).
- **Plugin update:** if the hub says chat-hub-core was updated, restart
  at your next stopping point (as its message says); the start note then
  has you reload this skill.
- **Dev server:** keep exactly two browser tabs on it, yours first, then
  the owner's. Only ever drive your own: pass its tab ID to every browser
  call (a call without one acts on whichever tab is in front), and give
  any helper agent that uses the browser the same rule.
