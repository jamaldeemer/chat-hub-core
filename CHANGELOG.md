# Changelog (chat-hub-core, formerly chat-core)

Each version is a git tag (`v0.1.0`). Projects pin a tag in
`.claude/settings.json`, so they get a new version only when they move to it.

## 0.3.11

Token use (from object_creator: the hub was about 3/4 of all spend,
re-reading ~450k tokens every turn):
- **The commit reminder fires only on `git commit`** (it appeared on every
  command, adding to every turn's context).
- **A stats line after every turn**, for the owner only: context size,
  turns, and token-reads so far (`stats: false` hides it).
- **Self-trim:** past `trimAt` (default 150k, hub only; `trimAtWork` for
  work chats) a chat is told once to update its notes and ask the owner to
  clear it.
- **Hub rules for cheaper turns:** change titles only on real status
  changes and batch them; never sleep-poll; read parts of files.
- `scripts/all-prompts.sh` rebuilds `docs/all-prompts.md` (it used to live
  outside the repo).

## 0.3.10

From object_creator, tried there by hand first:
- **Only the hub sets status symbols** (🟡 🔴 ✅). Work chats never change
  their own titles (they kept overwriting the hub's); they tell the hub
  when they push and how CI ended. Reverses 0.3.5's "pushing chat sets its
  own mark".
- **After a release, merge main at once, push it with the next change**
  (unless the work is finished and waiting for a release: then push at
  once). Ten chats pushing bare merges queued CI for an hour.
- **Re-read CLAUDE.md after merging main;** a running chat only read it at
  the start. The hub states new rules in its "merge main" message.
- **Merge main with the app's "sync with base branch" tool** when there is
  one: it runs outside the sandbox, so merges touching `.claude/…` don't
  fail half-way. Merging the release preview still needs the owner.

## 0.3.9

- **Closing a chat is checked, not trusted.** The chat sends a wrap-up
  report in a fixed shape (commit, each `done` item with what it ran,
  follow-ups, anything open) and never calls itself ready. The hub runs
  `hooks/close-check.mjs <folder>`: nothing uncommitted; level 1+ on its
  own branch, pushed, and merged into the release preview; level 2 CI
  passed and no fix still waiting for the owner's check. Only then ✅. The
  owner archives; the hub never does.
- **`followups` setting:** the one file chats write follow-ups to (setup
  asks; default `docs/backlog.md`).

## 0.3.8

Pulled in from object_creator's hub:
- **Status symbols** first in titles: 🟡 push in CI, 🔴 CI failed, ✅ ready
  to close (replacing `! `, `(!)` and `(Ready to close)`). The pushing chat
  sets 🟡/🔴; the hub sets ✅.
- **Talk chats** for questions, research and planning: no release tag, no
  branch; `Z ` first in release-first titles so they sort last.
- **Hub notes** in `.git/chat-hub/hub-notes.md`, kept current by the hub;
  the start note tells a starting hub to read them first.
- Release notes list included chats as `- **Title** (CODE, `branch`)`.
- If CI can't run at all, the hub asks the owner whether to merge on the
  jobs that passed. If its sandbox blocks a merge, it gives the owner the
  command.
- Work chats drive only their own browser tab, by its tab ID.

## 0.3.7

- The hub's title shows only the soonest next release (`· R15+`), not one
  of each kind.
- `(Ready to close)` goes at the very start of a chat's title, so those
  chats sort to the top.

## 0.3.6

- **Hard stops for rules that used to rely on memory** (a new guard hook;
  level 1+ unless noted): a work chat can't commit on the main branch;
  nobody can rebase; a work chat can't edit files in another chat's
  worktree; and (any level) a work chat's commit message must start with
  its code (`3F: …`). The hub is exempt where releases need it.
- **The hub's own title:** it no longer renames or suggests renaming
  itself; it only adds the next release as a suffix
  (`Object Creator Hub · R15`, or `· R15+ R16~` with tick-tock) and keeps
  that current.
- **Stops loudly instead of guessing:** a broken settings file is reported
  in every chat; with no hub recorded, chats tell the owner instead of
  guessing a hub by name; a work chat that can't reach its hub stops and
  says so; `/chat-hub-core:hub` in a second chat refuses while another is
  recorded (type `/chat-hub-core:hub replace` to switch; `set-hub.mjs`
  takes `--replace`).
- **Setup picks the hub:** its last step asks "make this chat the hub?"
  (default yes) and records it, so a project never runs without one.
- **Release-first titles** (setting `titles: "release-first"`):
  `R16~ A3 · Fix menu spacing`, release padded to two digits, so an
  alphabetical sort groups chats by release. The in-CI mark is `(!)` after
  the code there. The default stays `3F · Title (R7)`.

## 0.3.5

- **The hub is recorded by two IDs:** Claude's session ID and the desktop
  app's address (`local_…`). Work chats message the app address (the
  session ID couldn't be messaged), and a hub that restarts or is cleared
  recognises itself instead of loading the work-chat rules.
  `set-hub.mjs --session <id> --app <local_…>`; older records still work.
- **The chat that pushes manages its own `! `** (level 2): it adds it when
  CI starts and removes it when the run ends. The hub only checks titles.

## 0.3.4

- The hub's session ID is kept in git's shared folder (`.git/chat-hub/hub`),
  so every chat and worktree sees it at once instead of after a release.
  `/chat-hub-core:hub` records it through a hook, which works from a
  sandboxed chat; `hooks/set-hub.mjs` does the same by hand.
  `hubSession` in the settings still works, as the fallback without git.
- Each chat's start note includes its own session ID.
- The push guard tells "CI hasn't passed" apart from "couldn't ask CI"
  (expired token, no network) and shows the command's own error. A
  `ci.passed` command must print `1` or `0`, and fail when it can't ask:
  if yours prints `0` on errors, make it exit non-zero instead.
- Hubs with the same name in different projects: with no hub recorded, a
  chat checks a candidate's folder and asks the owner if unsure; work
  chats message the hub by session ID only; the hub suggests a
  project-named title (`cns Hub`).

## 0.3.3

- New plugin description.

## 0.3.2

- Setup ends with numbered "Get started" steps for the project's level.
- README: an "Updating" section, and a note to `git init` an empty folder
  first for level 1 or 2.

## 0.3.1

- **The hub is found by session ID.** The hub writes its session ID to
  `hubSession` in `.claude/chat-hub.json`; the start hook tells every chat
  which session that is. Make any chat the hub with `/chat-hub-core:hub`
  or a name ending in "Hub" or "Manager". The `hub` name setting is gone.
- **Chat codes are two characters:** one of A C E F plus one digit 2–9
  (`3F`, `A7`), no lookalikes.
- **The push guard switches itself on:** the start hook sets
  `core.hooksPath` when the project has `.githooks/pre-push` and nothing
  else is set. No manual step.
- **Setup:** pins a plugin version only if you ask; anything left to do by
  hand comes in one block at the end; when it can't write
  `.claude/settings.json` it shows the whole merged file.
- README rewritten for a new user (install first, a diagram of the
  levels, the files setup writes). Skills, templates and hook messages
  trimmed by about a third and clarified.

## 0.3.0

- Renamed from chat-core to **chat-hub-core**, the core of a chat-hub
  family (a `chat-hub-local` layer can follow). Commands are now
  `/chat-hub-core:setup`; skills `chat-hub-core:hub` and
  `chat-hub-core:work-chat`.
- Shared names use `chat-hub`: the marketplace (`chat-hub-core@chat-hub`),
  the settings file `.claude/chat-hub.json`, the CLAUDE.md markers
  `<!-- chat-hub -->`.
- The repo is `jamaldeemer/chat-hub-core`.
- Released under the MIT license (`LICENSE`).
- Upgrading from 0.2.x or older: install the new name, then run
  `/chat-hub-core:setup`; it moves the old files to the new names.

## 0.2.0

- One word for the chat you talk to: the **hub** (was also "Session
  Manager"). The skill is now `chat-core:hub`.
- Each project's hub has its own name, `hub` in `.claude/chat-core.json`
  (`<project> Hub`), so chats in two projects never message each other's
  hub. Briefs carry the hub's session ID; work chats message only that hub.
- The hub ignores (and says so to) messages from other projects' chats.
- Upgrading from 0.1.x: re-run setup to add `hub`, then rename the hub chat.

## 0.1.1

Fixes from the first sandbox run of setup:
- The summary before writing says what each file does, in plain words, and
  what the owner must run themselves.
- Warns when level 1+ meets a repo with no commits, or a "done" rule the
  project can't check yet.
- Finds the plugin's repo from `plugin.json` (`repository`), not git.
- The version pin adds only what's missing, and points out a duplicate
  `chat-core` marketplace in the owner's own settings.
- Gives the owner `git config core.hooksPath .githooks` when it can't run
  it; chats now remind the owner while the push guard is off.
- Leaves level 2 fields out of the settings below level 2.

## 0.1.0

First version: levels 0–2, the setup, session-manager and work-chat skills,
the session-start and before-commit hooks, the pre-push gate on main.
