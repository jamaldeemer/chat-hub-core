# chat-core

A Claude Code plugin for running many Claude chats on one project: one hub
chat you talk to, which hands each task to its own short-lived chat, keeps
their titles tidy, and (if you want) gathers their work into releases that
reach your main branch only after CI passes and you've checked the fixes.

## Install in a project

1. In the project, start Claude with the plugin (terminal):
   `claude --plugin-dir ~/projects/chat_core`
2. Type `/chat-core:setup`. It looks at the project, asks 2–5 questions, shows
   what it will write, and writes it when you say yes. It also offers to pin
   a released version of the plugin in the project's `.claude/settings.json`;
   after that it loads in the desktop app too, without step 1.
3. Name one chat as setup says (`<project> Hub`, e.g. `object_creator
   Hub`) and talk to it. Each project's hub has its own name, so chats never
   message another project's hub.

Or install it for yourself from the private repo (needs git access to it):
`/plugin install chat-core --marketplace jamaldeemer/chat-core`, then step 2.

Run `/chat-core:setup` again any time to change the answers or the level, or
to move the project to a newer version.

## Releasing a version

1. Bump `version` in `.claude-plugin/plugin.json` and add a section to
   `CHANGELOG.md`.
2. Commit, then tag: `git tag v0.2.0`.
3. Push the branch and the tag: `git push origin main v0.2.0`.

Projects stay on their pinned tag until setup (or you) moves them.

## Levels

| Level | What you get | Needs |
|---|---|---|
| 0 · chats | Hub + one chat per task, codes in titles (`C34 · Title (R7)`), briefs, wrap-ups, "(Ready to close)", no idle pings | nothing |
| 1 · branches | Each chat on its own branch and worktree; a release gathers finished branches; chats merge main after each release | git |
| 2 · CI and checks | Main only gets a release whose exact commit passed CI; unchecked fixes block it; "! " in titles while a push is in CI | CI you can ask "did commit X pass?" |

## Design

**Behaviour is in the plugin, not in your CLAUDE.md.** The rules live in
three skills (`setup`, `hub`, `work-chat`); a SessionStart hook
tells each chat which one to load. Your CLAUDE.md only gets a three-line
pointer, so your own project rules stay readable.

**The interfaces are settings, not code.** Everything the core needs from
the outside world is in `.claude/chat-core.json`:

| Need | Setting | Example |
|---|---|---|
| Did CI pass on a commit? | `ci.passed`: a shell command with `$SHA`, prints `1` if yes | `gh run list --commit $SHA --status success --json headSha --jq length` |
| Which fixes aren't checked yet? | `fixes.toCheck`: a file in each worktree, lines `- #n what to try` | `.claude/issues-to-check.md` |
| Definition of "done" | `done`: a list | `["tests pass", "it builds"]` |
| Branch names | `branches.main`, `branches.release` | `main`, `release` |
| Releases in titles | `releases`: `plain` (default), `tick-tock`, `none`; `nextRelease` | |
| Plugin version | `.claude/settings.json` pins a tag of this repo (setup writes it) | `"ref": "v0.1.0"` |
| Start, rename, message chats | whatever session tools Claude has; without them the hub hands you the brief to paste | |
| Dev server per chat | `devServer.command` (optional) | `npm run dev -- --port 0` |

Nothing in the core names a git host, CI service, framework or app. A
project-specific layer (e.g. a CI view page, an issues page, a version
stamp) stays in that project and reads the same settings.

**Files:** `skills/` (the rules), `hooks/` (session start, before commit),
`githooks/pre-push` (the gate on main, POSIX sh + node), `templates/` (brief,
wrap-up), `tests/run.sh` (the hooks and gate in throwaway repos).

## Checks

`sh tests/run.sh` · `claude plugin validate .`
