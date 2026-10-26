# Backlog

Open work for chat-hub-core. Newest first within each section.

## Next

- **The hub's recorded ID can't be messaged.** The hook records Claude
  Code's session ID, but the desktop app's messaging uses its own session
  addresses (`local_…`), so a work chat can't send to the ID in its brief
  and falls back to guessing among linked chats (seen in the sandbox,
  2026-10-25). Fix: when the hub records itself, also save its app address
  (from the app's session tools, "self"); briefs and start notes give that
  for messaging and keep the session ID for matching.
- **Clearing a long hub without losing track** (goes with the item above).
  1. Nudge: a hook checks the hub's transcript size on each message and,
     past a limit (setting, e.g. `hubReminderKB`), has the hub suggest once
     "I'm getting long; save my notes and start fresh?".
  2. Handoff: before clearing, the hub writes what it tracks (open chats,
     codes, branches, release tags, what waits on the owner, the release
     preview) to `.git/chat-hub/hub-notes.md` (shared, never committed).
  3. Pick up: after the clear, the start note tells the hub to read that
     file first.
  Clearing gives the chat a new session ID, so the hub must be recorded by
  its app address (which survives a clear) or it stops being the hub.
- **A hub recorded by app address isn't recognised on restart.**
  object_creator's hub recorded `local_…` (messageable, good), but the start
  hook compares against the session ID, so if that chat restarts it's told
  it's a work chat until `/chat-hub-core:hub` is typed again. Fixed by
  storing both IDs (first item).
- **Renaming a chat yourself triggers permission prompts.** The hub keeps
  titles "current", so after the owner renames a work chat, the hub renames
  it back and the app asks permission each time. Fix: the hub treats a
  title that differs from the one it last set as the owner's, keeps that
  wording and only adds or updates the code and release tag (and asks
  first if even that would change it). Plus: setup offers to pre-approve
  the rename tool so the remaining prompts go away (see "Earlier ideas").
- **Less confusing marketplace name.** The marketplace is `chat-hub` and
  the plugin `chat-hub-core`, so commands mix both
  (`marketplace update chat-hub`, `plugin update chat-hub-core@chat-hub`)
  and it's easy to type the wrong one. Pick names that read clearly
  (e.g. marketplace `jamaldeemer` or `chat-hub-plugins`), keeping room for
  a later `chat-hub-local`. Renaming means every project removes and
  re-adds the marketplace once, so do it together with another release.
- Trim the brief: it repeats "load the work-chat skill", which the start
  hook already does.

## From moving object_creator onto the plugin (2026-10-25)

Findings 1–3 shipped in 0.3.4. Still open:

- **Wrapping an existing pre-push** (setup): "add a line to theirs that
  runs it" is unsafe, since git passes the pushed refs on stdin and only one
  reader gets them. Show the pattern:
  `input=$(cat); printf '%s\n' "$input" | sh "$(dirname "$0")/chat-hub-pre-push" || exit 1`.
- **Setup's suggested `ci.passed`:** `gh run list --commit` needs a recent
  gh and can't reach GitHub from a sandboxed chat. Suggest a REST query on
  `head_sha` + `status=success` (object_creator's `scripts/ci-passed.sh`).
- **Where pre-push reads settings:** with an absolute `core.hooksPath` to
  the main folder, the hook comes from main but the settings from the
  pushing worktree. One line in the README.
- **Tick-tock and `nextRelease`:** fixes and features chats take different
  next releases (R14~ vs R15+). The hub skill should say how to work out
  each kind's number from the one setting.
- **Moving from a project's own chat codes:** say that open chats keep their
  old codes until they close (2-character codes can't clash with longer
  ones).
- **Commit reminders stack:** a project with its own commit hook gets two
  notes. Setup could offer to move its text into `commitReminder`.
- **Version drift:** unpinned projects silently run whatever version the
  owner's marketplace points at. The start note could say which version is
  running.

## From moving coaster_graph onto the plugin (2026-10-25)

- `devServer` in the settings is never read by anything; use it (work chat
  starts its server with it) or drop it.
- The CLAUDE.md block names the hub by title in a committed file; titles go
  stale and repeat across projects. Point to "the recorded hub" instead.
- A chat the hub didn't start has no code, so "commit messages start with
  your code" can't be followed. Say what to do (e.g. no prefix, or ask the
  hub for a code).
- A fresh clone or another computer gets "plugin not found": settings turn
  the plugin on but don't add the marketplace. Setup could add the
  marketplace entry (unpinned) to the project's settings too.
- The hub is told to "run the done checks", but `done` items are sentences
  ("docs updated"), not commands. Allow an optional command per item.

## Versions and updating

- On one computer, Claude Code keeps one copy per marketplace name, so two
  projects can't reliably be pinned to different versions by marketplace
  `ref`. Each project's install does stay on its version until
  `claude plugin update` is run there; confirm this and say so in setup and
  the README (setup's "pin" step may not be needed at all).
- Show the running version in each chat's start note.

## Earlier ideas

- Setup offers to pre-approve the hub's session tools (start, rename,
  message), so the owner sees fewer permission prompts.
- Level 1 blocks direct pushes to main, not only level 2.
- An `overrides` setting so projects can change a core rule without a fork.
- Rebuilding `docs/all-prompts.md`: put its script in the repo.
- Hooks in plain sh instead of Node (undecided).
- A `/review` helper: publish files as a commentable page, then apply the
  comments (could live in a chat-hub-local layer).
- A `/chat-hub-core:feedback` command to send plugin changes from any
  project to the plugin's own chat.
