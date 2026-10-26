# chat-hub-core

A Claude Code plugin for running many Claude chats on one project. You talk
to one **hub** chat; it starts a chat for each task, keeps their titles
tidy, tells you when each can close, and (optionally) gathers their work
into releases that reach `main` only after CI passes.

## Install

You need Claude Code (terminal or the desktop app's Code tab), git and Node.

1. Add this marketplace (once per computer), in a terminal:

   ```
   claude plugin marketplace add jamaldeemer/chat-hub-core#v0.3.4
   ```

2. Turn the plugin on in your project:

   ```
   cd path/to/your-project
   claude plugin install chat-hub-core@chat-hub --scope project
   ```

   Starting from an empty folder? Run `git init` there first if you want
   level 1 or 2 (branches need git).

3. Open a new chat in the project (terminal or desktop app; trust the
   folder if asked) and type `/chat-hub-core:setup`. It asks a few
   questions, shows what it will write, and writes it when you say yes.
4. Make one chat the hub: type `/chat-hub-core:hub` in it, or give it a
   name ending in "Hub" or "Manager" (e.g. `cns Hub`). It records its
   session ID, so every other chat knows exactly which one it is. Then talk
   to it.

Setup writes only inside your project, and only after you say yes:

- `.claude/chat-hub.json`: the settings.
- `CLAUDE.md`: a short block between `<!-- chat-hub -->` markers.
- `.claude/settings.json`: only if you ask to pin a plugin version.
- Level 1+: `.githooks/pre-push`, the push guard. Each chat switches it on
  in its checkout if needed (`core.hooksPath`, which git doesn't commit).
- Level 2: one line in `.gitignore`.

Commit them and anyone who clones the project gets the same setup (they
only repeat steps 1–2). Run setup again to change level or move to a newer
version.

## Updating

A project uses the version your marketplace points at. To move to a new
one (e.g. `v0.4.0`):

```
claude plugin marketplace remove chat-hub
claude plugin marketplace add jamaldeemer/chat-hub-core#v0.4.0
cd path/to/your-project
claude plugin install chat-hub-core@chat-hub --scope project
```

Then start a new chat (open chats keep the old version) and run setup
again if the CHANGELOG says to.

## Levels

| Level | Adds | Needs |
|---|---|---|
| 0 | Hub + one chat per task, codes in titles (`3F · Title (R7)`), briefs, wrap-ups | nothing |
| 1 | Each chat on its own branch; releases gather finished branches | git |
| 2 | `main` only gets releases that passed CI and whose fixes you've checked | CI you can ask "did commit X pass?" |

What happens to your code at each level:

```
LEVEL 0 · chats only (git optional)

  you <-> hub --brief--> 3F chat  --commits, with your OK--> your project


LEVEL 1 · + branches

  3F chat  --+   each on its own branch + worktree
  A7 chat  --+--push branch--> hub merges each finished branch into
  ...      --+                 `release` (a preview) and runs your
                               `done` checks (tests, build...)
                                          |
                     you say "release" and pick the branches
                                          v
                               `release` = main + those branches
                                          |  you push it to main
                                          v
                                        main --> every open chat merges main


LEVEL 2 · + CI and checks

  chat pushes its branch ----> CI runs     (title shows "! " meanwhile)
  you push `release` --------> CI runs on that exact commit
                                          |
                  CI passed, and you've tried every "Fixes #n" it ships
                                          v
                        you push that same commit to main

  The pre-push hook refuses main if CI hasn't passed on that commit,
  or a fix it ships is still listed in .claude/issues-to-check.md.
```

## How it works

The rules are three skills: `setup`, `hub`, `work-chat`. A start-of-chat
hook tells each chat which to load, and which session is the hub: the hub
records its ID in git's own folder (never committed), so every chat and
worktree sees it at once. Your project gets a settings file,
`.claude/chat-hub.json` (level, release style, what "done" means, the CI
command), and a three-line note in CLAUDE.md. Nothing in the plugin names
a git host, CI service or framework.

## Working on the plugin

- Try unreleased changes: `claude --plugin-dir path/to/chat-hub-core`
- Checks: `sh tests/run.sh` and `claude plugin validate .`
- Release: bump `version` in `.claude-plugin/plugin.json`, add a
  `CHANGELOG.md` section, commit, `git tag vX.Y.Z`, push the branch and tag.
  Projects keep their pinned version until setup moves them.

## License

MIT
