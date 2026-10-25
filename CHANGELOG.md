# Changelog

Each version is a git tag (`v0.1.0`). Projects pin a tag in
`.claude/settings.json`, so they get a new version only when they move to it.

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
