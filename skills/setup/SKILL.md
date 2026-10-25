---
name: setup
description: Set up or change chat-core for this project. Looks at the project, asks the owner a few questions, then writes .claude/chat-core.json and the bits each level needs. Use when the owner types /chat-core:setup or asks to set up, change or remove chat-core.
---

# chat-core setup

Set up chat-core for the project in the current folder: look first, ask only
what you couldn't tell, show a summary, write only after the owner says yes.
Running it again changes the answers (move a level up or down); never lose
the owner's own edits to files you touch.

## 1. Look (read only)

Check, without asking:

- Is it a git repository? Any remote? Other worktrees (`git worktree list`)?
- CI: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`, etc.
- A dev server: `package.json` scripts like `dev`/`start`, or similar.
- Releases already: tags, a `CHANGELOG.md`, a `release` branch.
- An existing `.claude/chat-core.json` (then this is a change: start from it).
- An existing CLAUDE.md, and any hand-written "Session Manager" rules in it.

## 2. Suggest a level

- **Level 0, chats only.** A hub chat hands each task to its own chat; codes
  in titles; briefs, wrap-ups, "(Ready to close)", no idle pings. Needs
  nothing else, not even git.
- **Level 1, + branches.** Each chat on its own branch and worktree, never
  committing on the main branch; a release gathers finished branches; chats
  sync after each release. Needs git.
- **Level 2, + CI and checks.** The main branch only gets a release whose CI
  passed; fixes the owner hasn't checked yet block it; "! " in titles while
  a push is in CI. Needs CI that can be asked "did this commit pass?".

Pick the highest level the project can support and that it seems to want.

## 3. Ask (AskUserQuestion, one batch, 2–5 questions)

Only what you couldn't tell. Usually:

1. The level (your suggestion first, marked Recommended).
2. Releases in titles: plain numbers (R1, R2…, the default), tick-tock
   (R10~ fixes, R11+ features, alternating), or none.
3. The definition of "done" here (e.g. tests pass, it builds, docs updated, the
   owner has seen it). Offer what you found in the project.
4. Level 2 only: how to ask CI whether a commit passed. Propose a command
   from what you found (e.g. `gh run list --commit $SHA --status success
   --json headSha --jq length`), the owner can change it.

## 4. Show the summary, then write

List each file you'll write or change, one line each, and wait for yes.

**Always:** `.claude/chat-core.json` (schema below).

**Level 0+:** a short block in CLAUDE.md between `<!-- chat-core -->` and
`<!-- /chat-core -->` (replace it if there; create CLAUDE.md if missing):

```
## Chats (chat-core)
This project runs several Claude chats at once with the chat-core plugin
(settings in .claude/chat-core.json). The hub chat is "Session Manager"; the plugin's
skills hold the rules.
```

**Level 1+:** `git config core.hooksPath` must point at a folder with the
plugin's `pre-push`. If the project has no hooks folder, copy
`${CLAUDE_PLUGIN_ROOT}/githooks/pre-push` to `.githooks/pre-push`
(executable) and set `git config core.hooksPath .githooks`. If it already has
one with its own pre-push, add a line to it that runs ours
(`"${CLAUDE_PLUGIN_ROOT}"`'s copy, saved into the project as
`.githooks/chat-core-pre-push`) and keep theirs.

**Level 2:** also add `.claude/issues-to-check.md` to `.gitignore`.

Lower level: remove what the higher level added (ask first).

## 5. Pin a version of the plugin

Offer to add the plugin to the project's `.claude/settings.json`, pinned to
one released version, so it loads without `--plugin-dir` (desktop app too)
and the project only changes version when the owner moves it.

- **Repo:** the GitHub `owner/repo` the plugin is published from. Suggest
  it from `git -C "${CLAUDE_PLUGIN_ROOT}" remote get-url origin`; ask if
  there's none.
- **Version:** the newest `v*` tag (`git ls-remote --tags <url> 'v*'`).
  Already pinned: show the current tag and the newer ones (with their
  CHANGELOG lines), and ask whether to move.

Merge into what's there:

```json
{
  "extraKnownMarketplaces": {
    "chat-core": { "source": { "source": "github", "repo": "<owner/repo>", "ref": "<vX.Y.Z>" } }
  },
  "enabledPlugins": { "chat-core@chat-core": true }
}
```

Tell the owner: Claude Code fetches it with their own git login (private
repos work if `git clone` of the repo works on this machine, e.g. after
`gh auth login && gh auth setup-git`); the project folder must be trusted
before the marketplace line applies; if a chat says the plugin "isn't
installed", run `claude plugin install chat-core@chat-core --scope project`.
If the file can't be written (sandbox), give the owner the text to paste.

## 6. Finish

Say in two lines what's on, and how to start: open a chat named "Session Manager" and
talk to it; it starts the other chats. Don't commit; the owner decides.

## Settings schema (.claude/chat-core.json)

```json
{
  "level": 1,
  "releases": "plain",              // "plain" (default) | "tick-tock" | "none"
  "nextRelease": 1,                 // the release the next finished work ships in
  "done": ["tests pass", "docs updated"],  // the definition of "done"
  "commitReminder": "",             // extra text shown before every commit
  "branches": { "main": "main", "release": "release" },
  "ci": { "passed": "" },           // level 2: shell command, $SHA set; exit 0 and print 1 if CI passed on it
  "fixes": { "toCheck": ".claude/issues-to-check.md" }, // level 2
  "devServer": { "command": "" }    // optional: how a chat starts its own server
}
```
