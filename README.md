# chat-hub-core

A Claude Code plugin for running many Claude chats on one project. You talk
to one **hub** chat; it starts a chat for each task, keeps their titles
tidy, tells you when each can close, and (optionally) gathers their work
into releases that reach `main` only after CI passes.

## Install

You need Claude Code (terminal or the desktop app's Code tab), git and Node.

1. Add this marketplace (once per computer), in a terminal:

   ```
   claude plugin marketplace add jamaldeemer/chat-hub-core
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
4. Setup ends by making a hub: by default the chat you ran it in. The hub
   records itself, so every other chat knows exactly which one it is, and
   adds the next release to its title (`⚪ cns Hub · R2`). Then talk to it.
   To make a different chat the hub later, type
   `/chat-hub-core:hub replace` in it.

Setup writes only inside your project, and only after you say yes:

- `.claude/chat-hub.json`: the settings.
- `CLAUDE.md`: a short block between `<!-- chat-hub -->` markers.
- `.claude/settings.json`: only if you ask to pin a plugin version.
- Level 1+: `.githooks/pre-push`, the push guard. Each chat switches it on
  in its checkout if needed (`core.hooksPath`, which git doesn't commit).
- Level 2: one line in `.gitignore`.

Commit them and anyone who clones the project gets the same setup (they
only repeat steps 1–2). Run setup again to change level or other answers.

## Updating

When a new version is out, run this in each project you want to move:

```
claude plugin marketplace update chat-hub
cd path/to/your-project
claude plugin update chat-hub-core@chat-hub
```

Open chats keep the version they started with. The hub notices the
update on its next prompt and tells each open work chat to restart
(terminal: exit, then `claude --continue`; desktop app: quit and reopen
the app), which keeps the conversation and loads the new version.
Restart the hub too. Run setup again if the CHANGELOG says to. Projects you don't
update stay on the version they have. To see which version each project
has: `claude plugin list`.

## Levels

| Level | Adds | Needs |
|---|---|---|
| 0 | Hub + one chat per task, codes in titles (see [Titles](#titles)), briefs, wrap-ups | nothing |
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
                                                 (pushed with its next change)


LEVEL 2 · + CI and checks

  chat pushes its branch ----> CI runs     (its title shows the in-CI mark)
  you push `release` --------> CI runs on that exact commit
                                          |
                  CI passed, and you've tried every "Fixes #n" it ships
                                          v
                        you push that same commit to main

  The pre-push hook refuses main if CI hasn't passed on that commit,
  or a fix it ships is still listed in .claude/issues-to-check.md.
```

## Titles

Each work chat gets a two-character code (one of A C E F plus a digit
2–9, e.g. `3F`, `A7`), which also starts its commit messages (`3F: Fix the
menu`). Setup asks which title style the project wants:

| | Code first (default) | Release first |
|---|---|---|
| New, nothing pushed yet | `⚪ 3F · Fix menu spacing (R7)` | `⚪ R07 3F · Fix menu spacing` |
| Tick-tock releases | `⚪ 3F · Fix menu spacing (R16~)` | `⚪ R16~ 3F · Fix menu spacing` |
| Waiting on your OK | `🟡 3F · Fix menu spacing (R7)` | `🟡 R07 3F · Fix menu spacing` |
| OK given, pushing | `⏳ 3F · Fix menu spacing (R7)` | `⏳ R07 3F · Fix menu spacing` |
| Push in CI (level 2) | `🚀 3F · Fix menu spacing (R7)` | `🚀 R07 3F · Fix menu spacing` |
| CI passed (level 2) / pushed (level 1) | `🟢 3F · Fix menu spacing (R7)` | `🟢 R07 3F · Fix menu spacing` |
| CI failed (level 2) | `🔴 3F · Fix menu spacing (R7)` | `🔴 R07 3F · Fix menu spacing` |
| Ready to close | `✅ 3F · Fix menu spacing (R7)` | `✅ R07 3F · Fix menu spacing` |
| Talk chat (no release) | `⚪ A4 · Compare slicers` | `⚪ Z A4 · Compare slicers` |
| The hub | `⚪ cns Hub · R7` | `⚪ cns Hub · R07` |

Talk chats and the hub keep ⚪: they never push.

Release first pads the number to two digits, so an alphabetical sort
groups chats by release, and talk chats (`Z `) sort last. With tick-tock,
`~` releases are fixes and `+` releases features; the hub's title shows
the soonest next release (`⚪ cns Hub · R15+`). The hub also keeps notes in
git's own folder (`.git/chat-hub/hub-notes.md`), so a restart or a clear
loses nothing.

## How it works

The rules are three skills: `setup`, `hub`, `work-chat`. A start-of-chat
hook tells each chat which to load, and which chat is the hub: the hub
records itself in git's own folder (never committed) by two IDs, Claude's
session ID and the desktop app's address, so every chat and worktree sees
it at once, can message it, and it stays the hub after a restart. Your
project gets a settings file,
`.claude/chat-hub.json` (level, release style, what "done" means, the CI
command), and a three-line note in CLAUDE.md. At level 1+, a guard hook
refuses a few things outright instead of trusting chats to remember:
committing on main, rebasing, editing another chat's folder, and (any
level) commit messages without a code. When something is wrong (a broken
settings file, no hub, a hub it can't reach), chats stop and tell you
rather than guess.

**Token use.** After every turn you see one line, e.g. `Context 182k ·
312 turns · this chat ≈ 41M token-reads` (Claude doesn't see it; set
`"stats": false` to hide it). Every turn re-reads the whole context, so
long chats, the hub above all, cost the most. When the hub passes
`trimAt` (default 150k tokens) it updates its notes and asks you to clear
it, and reminds again every `trimEvery` tokens over (default 25k), saying
how far over it is; work chats do the same past `trimAtWork`, if set.

A chat is marked ✅ (ready to close) only after it sends
a fixed wrap-up report and the hub's `close-check` confirms its folder is
committed, pushed, merged into the release preview and (level 2) green;
you archive it. Nothing in the plugin names a git host, CI service or
framework.

## Working on the plugin

- Try unreleased changes: `claude --plugin-dir path/to/chat-hub-core`
- Checks: `sh tests/run.sh` and `claude plugin validate .`
- After changing a prompt: `sh scripts/all-prompts.sh` rebuilds
  `docs/all-prompts.md`.
- Release: bump `version` in `.claude-plugin/plugin.json`, add a
  `CHANGELOG.md` section, commit, `git tag vX.Y.Z`, push the branch and tag.
  Projects move to it when their owner runs the Updating steps.

## License

MIT
