# Changelog (chat-hub-core, formerly chat-core)

Each version is a git tag (`v0.1.0`). Projects pin a tag in
`.claude/settings.json`, so they get a new version only when they move to it.

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
