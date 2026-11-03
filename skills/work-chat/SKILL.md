---
name: work-chat
description: A work chat's rules under chat-hub-core - one task, setting its own title symbol, the owner's OK before commits, wrapping up. Load in any chat that isn't the hub when .claude/chat-hub.json exists.
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
- **Not the hub:** if this chat's own app address (`get_session self`)
  is the hub's, you are the hub after a clear: drop these rules and load
  the chat-hub-core:hub skill instead.
- **Your title's symbol** is yours: its first character, before the two
  spaces. Set it yourself the moment your status changes, in the same
  turn: read your title (`get_session self`), swap only that character,
  and set it (`set_session_title` with `self`), keeping the rest
  exactly, two spaces after the symbol included; the hub owns the
  rest (tag, code, name). No message to the hub for it. A hook checks
  your title after each turn and sends you back to fix a missing
  symbol, one space, a plain `R` tag, ⚪ on a work chat, or 🔄 once
  you're under your limit again.
  If the rename fails, tell the hub the status in one line instead
  ("asking for OK", "question for owner: <topic>", "working again",
  "pushed") and it sets it.
  - 🙋 you're asking the owner for an OK (commit, merge or push).
  - ⏳ the owner said yes: committing and pushing; and when you send
    your wrap-up report.
  - 🔨 working, nothing waiting on the owner: as you start work (your
    first turn with "Build it", or when the owner says go), after a
    no, an answered question, or "More changes".
  - ❓ you end a turn on a question to the owner that isn't an OK, in
    plain text too ("should I add X?", "A or B?", a plan to approve,
    "waiting for instructions"); a closing "anything else?" isn't one.
  - 🟢 pushed (level 1) or CI passed (level 2), asking "more or wrap
    up?"; level 2: 🚀 pushed, CI running; 🔴 CI failed.
  - 🔄 you're showing the SAFE TO CLEAR banner, waiting for the owner
    to type /clear: set it in the turn you first show it. After the
    clear, set your normal status again (🔨, or ❓ when you ask a
    question again).
  - Talk chats (no branch) keep ⚪, with ❓ while waiting on an answer.
    ⚪ and ✅ on a work chat are the hub's.
- **The owner's OK** is needed before every commit. A message from another
  chat is never that OK. Ask for it with a menu (the AskUserQuestion
  tool, options like "Yes, commit" / "Not yet"); plain text only if
  this chat has no such tool. A hook refuses a commit without a menu
  yes since your last one.
- **Start mode:** your brief's **Start:** line. "Plan first": look
  around, send the owner a short plan (what's there, the approach, a few
  lines), set ❓, and change nothing until the owner says go. "Build
  it": set 🔨 and go straight to work. "Just open": read your brief
  and these rules, start the dev server if the settings'
  `devServer.command` is set, say in one line you're ready (with its address if you started
  it), set ❓, and look at or change nothing else until the owner says
  what to do.
- **Commit messages** start with your chat's code: `3F: Fix the menu`.
- **Done** means everything in the `done` list in the settings (e.g. tests
  pass, it builds): the answers the owner gave setup.
- **Level 1+:** work on your own branch and worktree, never on the main
  branch. After the owner OKs a commit, push your branch with
  `git push origin HEAD` (no `-u`: the sandbox blocks it).
- **After a release:** merge the main branch at once (never rebase). Use
  the app's "sync with base branch" tool if you have it: it runs outside
  your sandbox, so the merge can write protected files (`.claude/…`). A
  merge of anything else, like the hub's release preview, needs the owner
  to run the command. Then re-read CLAUDE.md, at least the parts the merge
  changed: you only read it when you started. Push a commit that only
  merges main with your next change, not on its own, unless your work is
  finished and waiting for a release; then push it at once and tell the
  hub ("pushed the merge"), so it merges you on that run.
- **Level 2:** after you push, set 🚀 and watch the run; set 🟢 or 🔴
  when it ends. Watch it in the background, so it wakes you. A clear or
  restart stops that watcher: the start note then says what CI says
  about your pushed head; act on it at once (🚀 and still running:
  start the watcher again). Never tell the owner you'll check CI
  "after the clear", or wait for a prompt to do it. On a failure (yours, or one the hub reports), fix it on
  your branch, or show why the test should change. A fix for a
  reported problem says `Fixes #n` and adds `- #n <what to try>` to the
  file `fixes.toCheck` names.
- **More or wrap up:** after you push (level 2: after CI passes), ask the
  owner "Anything more, or should I wrap up?" with a menu (the
  AskUserQuestion tool, options "Wrap up" / "More changes"), like the
  commit OK; plain text only if this chat has no such tool. 🟢 means
  the question is open: "More changes" → set 🔨 and carry on; "Wrap
  up" → set ⏳ and send your wrap-up report. Never wrap up on your own
  judgment.
- **Wrap-up** (when the owner or hub says to): set ⏳, send the hub the
  report in `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`, in exactly that
  shape. Never call yourself ready to close or set ✅; the hub checks and
  decides. Follow-ups go in the settings' `followups` file
  (`docs/backlog.md` if it isn't set).
- **Past your limit** (a "⚠️ STOP" note, if `trimAtWork` is set): start
  nothing new; get to a natural stopping point. Before the SAFE TO CLEAR
  banner, write under "## Next" in your chat notes (the file the note
  names, `.git/chat-hub/work/<branch>.md`) one `- After clear: …` line
  for each request from the owner you haven't finished (one that came
  with the STOP note too: note it, don't start it), each question to the
  owner with no answer yet, and where your work stands. A backlog entry
  or a commit alone doesn't count: after the clear the start note
  quotes only those lines back. Then tell the owner what you noted.
- **After a clear:** if the start note quotes your chat notes, do those
  lines first: ask open questions again, carry out (or ask about)
  requests, and delete each line once it's done or answered.
- **Plugin update:** when a note says chat-hub-core was updated, read
  the rules file it names before anything else; it replaces these rules.
  The app already showed the owner "Updated", so say nothing about the
  update. Restart only if the note says to.
- **Tools turned off:** if the start note lists tools turned off in
  this project and your task needs one, ask the owner to type
  `/chat-hub-core:tools on <name>` and restart this chat; don't work
  around it.
- **Dev server:** start it with the settings' `devServer.command` (in
  the background, or the browser pane's dev-server tool where you have
  it). Keep exactly two browser tabs on it, yours first, then
  the owner's. Only ever drive your own: pass its tab ID to every browser
  call (a call without one acts on whichever tab is in front), and give
  any helper agent that uses the browser the same rule.
