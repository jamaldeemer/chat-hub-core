# How chat-hub-core works

The details behind the [README](../README.md): what the hooks check, where
things are kept, and why. You don't need any of this to use the plugin.

## The skills and the start hook

The rules are three skills: `setup`, `hub`, `work-chat`. A start-of-chat
hook tells each chat which to load, and which chat is the hub: the hub
records itself in git's own folder (never committed) by two IDs, Claude's
session ID and the desktop app's address, so every chat and worktree sees
it at once, can message it, and it stays the hub after a restart. In the
desktop app the start hook knows the hub by its app address, which a clear
doesn't change, so a cleared hub is told it's the hub outright (and its new
session ID recorded) instead of having to work it out.

Your project gets a settings file, `.claude/chat-hub.json` (level, release
style, what "done" means, the command that runs your checks, the CI
command), and a three-line note in CLAUDE.md. When something is wrong (a
broken settings file, no hub, a hub it can't reach), chats stop and tell
you rather than guess.

## What the hooks refuse

At level 1+, a guard hook refuses a few things outright instead of
trusting chats to remember: committing on main, rebasing, and editing
another chat's folder. At any level it refuses commit messages without a
code or without your OK: a work chat must ask with a menu (AskUserQuestion,
"Yes, commit" / "Not yet"), and the hook checks the chat's transcript for a
yes since its last commit. A typed yes, or another chat's message, doesn't
count; finishing a merge is exempt. `"okMenu": false` turns this off where
there's no menu tool.

At level 2 the pre-push hook refuses main if CI hasn't passed on that
commit, or a fix it ships is still listed in `.claude/issues-to-check.md`.

## The title check

After every turn a hook reads the chat's own title (the app keeps it in
`custom-title.json` beside the chat's transcript, also across a clear) and
sends the chat back once to fix it if:

- the symbol is missing,
- there's one space after it instead of two,
- the release tag has a plain `R` instead of `ʀ`, or
- a work chat is still on ⚪.

It never sends a chat back twice in a row. Talk chats and the hub keep ⚪;
titles that don't look like ours, and chats outside the desktop app, aren't
checked.

The app's notes about a chat ("The session "…" you started finished a
turn") and its message headers always show the title the chat *started*
with, never the current one, so the hub reads real titles from the session
list instead.

## The hub's open count

The hub's title ends with the number of chats still open for the coming
release: `⚪  Hub · ʀ12 (3)`. Talk chats, chats for later releases and ✅
chats don't count. The hub sets it whenever it retitles a chat (starting,
retagging, ✅, closing) and after a release.

The app tells the hub nothing when you close or delete a chat yourself, so
the hub also recounts every time it wakes (an event, your prompt, a start,
after a clear), from a session list it's taking anyway, archived chats
included. It retitles itself only when the count is wrong. The same list
checks the `## Open chats` part of its notes, which keep each chat's
session id: a chat whose id is gone is dropped, and one whose branch isn't
on main or the release preview is named to you once.

## Hub notes

The hub keeps notes in git's own folder (`.git/chat-hub/hub-notes.md`), so
a restart or a clear loses nothing. They're one current snapshot under
fixed headings (`## Me`, `Next`, `Shipped`, `Preview`, `Waiting`,
`Open chats`, `Plans`, `Gotchas`), edited in place. If they gain other
`## ` headings (dated or "checkpoint" blocks) or pass `notesMaxBytes`
(default 6000; 0 = off), a hook tells the hub to rewrite them before
anything else.

A closed (✅) chat is dropped from the notes as soon as the hub tells you
about it, so the hub never reminds you of chats you've already deleted; the
same hook flags any ✅ line left in the notes.

## Closing a chat: close-chat.mjs

At level 1+ the hub closes a chat with one command,
`hooks/close-chat.mjs <branch>`. It:

1. finds the chat's folder and runs the close check on it (committed,
   pushed and, at level 2, CI);
2. merges the branch into the `release` preview without touching any
   folder (a clash stops here and names the files for the chat to
   resolve);
3. runs your checks on a copy of the merge, unless the merge adds nothing
   to the branch (the chat's own run already covers it);
4. moves the preview to the merge only if the checks pass;
5. runs the full close check, now including "merged", and prints READY
   or FAIL.

**Which checks.** `checks` in `.claude/chat-hub.json` if it's set. If not,
the commands written in backticks in `done` (`"tests pass (\`npm test\`)"`),
else a default it finds in the merge: package.json's lint, typecheck, test
and build scripts (with the package manager its lock file names), else
`tests/run.sh`, else `make test`. The PASS line says which it ran. The copy
borrows the project's `node_modules`, so package scripts work, and it's
removed on every exit.

**When.** As soon as the wrap-up report is in, whatever release the chat
is tagged for: the branch waits in the preview, not in an open chat at ⏳.
There's no "parked" state; a problem found later is a normal bug in a new
chat. As a backstop, the hub's prompt hook remembers each report it sees
(`**Wrap-up · C7**`, kept in `.git/chat-hub/wrapups.json`) and, on every
later hub prompt and in its start note after a clear, reads the project's
chat titles (the app's `custom-title.json` for each worktree) and reminds
the hub to close any still at ⏳. A chat whose title moved on (✅, or 🔨
after a failed close) is forgotten, and so is one that can't be found
after a week.

**Where it merges.** If the hub's own folder has the preview checked out,
it merges there by a fast-forward (only with nothing uncommitted in it). A
preview checked out in any other folder stops it.

## CI after a clear (level 2)

A chat at 🚀 watches its CI run in the background, and a clear or restart
stops that watcher. So the start hook asks `ci.passed` about the chat's
pushed branch head and adds one line to its start note: passed, set 🟢 and
ask "more or wrap up?"; not yet, look at the run and watch it again (🔴 if
it failed). A chat with unpushed commits doesn't get the line.

As a backstop, the hub runs `hooks/ci-status.mjs` on every wake while any
chat shows 🚀, and tells each 🚀 chat whose head passed:

```
claude/add-csv 4f2a9c1 CI passed
claude/login-timeout 91be03d CI not passed yet
claude/print-view 2c7d410 not pushed
```

## The hub's wrap-up

When the hub passes its limit (`trimAt`, default 135k tokens, or one set
with `/chat-hub-core:limit`), it takes on no new work: anything new you or
a chat ask for goes in its notes as an "After clear:" line, which the start
note quotes back to it after the clear. It finishes what it already has in
flight (a merge or release it started, closing every chat whose wrap-up
report is in, titles it owes, replies to chats, messages it promised),
brings its notes up to date, and only then asks you to clear it, so a clear
never lands in the middle of a step.

It never asks with a question or buttons: a button can't clear a chat.
Once its bookkeeping is done it shows a boxed "✅ SAFE TO CLEAR: type
/clear" banner, and you type `/clear` in the hub chat. Raise its limit
while it's wrapping up and it carries on as normal.

**The hard stop.** `hooks/guard.mjs` enforces the limit in two stages, and
checks mid-turn (it reads what the transcript gained before each of the
hub's tool calls), so a long turn is stopped when it crosses the line:

1. **At the limit:** no new work. Starting a chat, a new tag
   (`git tag v…`; listing is fine), a commit whose message starts
   `Release`, and making or resetting the release branch (`checkout -B`,
   `switch -C`, `branch -f`) are refused. Finishing work still runs.
2. **`hardStopAfter` past it** (default 20k tokens): every tool is refused
   except reading, and editing or writing the hub notes.

Every refusal ends with how to lift it: you type
`/chat-hub-core:limit <higher>` or `off`. The hub can't do that itself:
past its limit it can't run `limit.mjs` or `set-hub.mjs`, or write
`limits.json`, `.claude/chat-hub.json`, the hub record or its usage
counts. A clear, or a limit above its context, lifts both stages. Work
chats' `trimAtWork` is only a reminder; they're never stopped.

## Limits and tools: where they're kept

- **Limits** from `/chat-hub-core:limit` are kept in
  `.git/chat-hub/limits.json`, next to the hub record, so every worktree
  sees them and they're never committed. They win over `trimAt` and
  `trimAtWork` in `.claude/chat-hub.json`. Without git they're written
  there instead.
- **Tools** from `/chat-hub-core:tools` are deny rules in the project's
  `.claude/settings.local.json` (just you, never committed; your own rules
  are kept). A denied tool is removed from the chat entirely, not just
  blocked. In the desktop app, worktree chats read the main checkout's
  settings, so the hub and work chats always get the same set. Which
  default-off groups were already turned off is kept in
  `.git/chat-hub/tools.json`, so each is turned off only once, and one you
  turn back on stays on.
- Tools you never use anywhere can go in your own `~/.claude/settings.json`
  the same way (`"permissions": {"deny": ["mcp__visualize"]}`), and plugins
  you don't use in a project can be turned off there with
  `"enabledPlugins": {"<plugin>": false}`, which also shortens the skills
  list every chat carries.

## Updates without a restart

Every hook runs through a small launcher (`hooks/run.mjs`) that runs the
version the project has installed now, not the one the chat started with.
On its next prompt after an update, each chat is told once to read its new
rules file; the app shows you one line, "Updated" ("Updated: restart this
chat" when the update changes which hooks run). Chats started on 0.3.20 or
earlier don't have the launcher: restart those once after moving to 0.3.21
or later.
