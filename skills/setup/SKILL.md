---
name: setup
description: Set up or change chat-hub-core for this project. Looks at the project, asks the owner a few questions, then writes .claude/chat-hub.json and the bits each level needs. Use when the owner types /chat-hub-core:setup or asks to set up, change or remove chat-hub-core.
---

# chat-hub-core setup

Set up chat-hub-core for the project in the current folder: look first, ask only
what you couldn't tell, show a summary, write only after the owner says yes.
Running it again changes the answers (move a level up or down); never lose
the owner's own edits to files you touch.

## 1. Look (read only)

Check, without asking:

- Is it a git repository? Any remote? Other worktrees (`git worktree list`)?
- CI: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`, etc.
- A dev server: `package.json` scripts like `dev`/`start`, or similar.
- Releases already: tags, a `CHANGELOG.md`, a `release` branch.
- An existing `.claude/chat-hub.json` (then this is a change: start from it).
- An older setup under the plugin's old name, chat-core: `.claude/chat-core.json`,
  `<!-- chat-core -->` markers in CLAUDE.md, `.githooks/chat-core-pre-push`,
  or `chat-core` entries in `.claude/settings.json`. Offer to move each to
  the new name (same contents) and remove the old one.
- An existing CLAUDE.md, and any hand-written hub rules in it (some projects
  call that chat "Session Manager"; chat-hub-core calls it the hub).

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

List each file you'll write or change and wait for yes. Say what each one
does for the owner in plain words, not its contents: e.g. "a settings file
for this project (level 1, releases R1, R2…; done = you've seen it, tests
pass)", "a short note in CLAUDE.md saying this project uses chat-hub-core", "a
git hook that stops pushes to main that skip a release". Below the list,
say what the owner will have to run themselves, if anything.

Before the list, flag what won't work yet:
- Level 1+ on a repo with no commits: chats can't make branches until
  `main` has a first commit. Say so, and offer to leave it to the owner.
- A "done" rule the project can't check yet (e.g. "tests pass" with no
  tests): say so; keep it only if the owner wants it as a goal.

**Always:** `.claude/chat-hub.json` (schema below).

**Level 0+:** a short block in CLAUDE.md between `<!-- chat-hub -->` and
`<!-- /chat-hub -->` (replace it if there; create CLAUDE.md if missing):

```
## Chats (chat-hub-core)
This project runs several Claude chats at once with the chat-hub-core plugin
(settings in .claude/chat-hub.json). The hub chat is "<hub>"; the plugin's
skills hold the rules.
```

**Level 1+:** `git config core.hooksPath` must point at a folder with the
plugin's `pre-push`. If the project has no hooks folder, copy
`${CLAUDE_PLUGIN_ROOT}/githooks/pre-push` to `.githooks/pre-push`
(executable) and set `git config core.hooksPath .githooks`. That setting
lives in `.git/config`, so it isn't committed and each clone needs it once;
if you can't write it (sandbox), give the owner the command to run. The
session-start hook reminds chats while it's missing. If it already has
one with its own pre-push, add a line to it that runs ours
(`"${CLAUDE_PLUGIN_ROOT}"`'s copy, saved into the project as
`.githooks/chat-hub-pre-push`) and keep theirs.

**Level 2:** also add `.claude/issues-to-check.md` to `.gitignore`.

Lower level: remove what the higher level added (ask first).

## 5. Pin a version of the plugin

Offer to add the plugin to the project's `.claude/settings.json`, pinned to
one released version, so it loads without `--plugin-dir` (desktop app too)
and the project only changes version when the owner moves it.

- **Repo:** the GitHub `owner/repo` the plugin is published from: the
  `repository` field of `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`
  (the installed copy isn't a git checkout, so don't ask git). Ask if it's
  missing.
- **Version:** the newest `v*` tag (`git ls-remote --tags <url> 'v*'`).
  Already pinned: show the current tag and the newer ones (with their
  CHANGELOG lines), and ask whether to move.

Read the project's `.claude/settings.json` and the owner's
`~/.claude/settings.json` first, and add only what's missing (installing
with `--scope project` already sets `enabledPlugins`). If the owner's own
settings also declare a `chat-hub` marketplace (e.g. from
`claude plugin marketplace add`), say so: the project's entry is the one
that should carry the version, and they can remove theirs to avoid the two
drifting apart.

Merge into what's there:

```json
{
  "extraKnownMarketplaces": {
    "chat-hub": { "source": { "source": "github", "repo": "<owner/repo>", "ref": "<vX.Y.Z>" } }
  },
  "enabledPlugins": { "chat-hub-core@chat-hub": true }
}
```

Tell the owner: Claude Code fetches it with their own git login (private
repos work if `git clone` of the repo works on this machine, e.g. after
`gh auth login && gh auth setup-git`); the project folder must be trusted
before the marketplace line applies; if a chat says the plugin "isn't
installed", run `claude plugin install chat-hub-core@chat-hub --scope project`.
If the file can't be written (sandbox), give the owner the text to paste.

## 6. Finish

Say in two lines what's on, and how to start: open a chat named exactly
the `hub` name and talk to it; it starts the other chats. Don't commit; the owner decides.

## Settings schema (.claude/chat-hub.json)

```json
{
  "level": 1,
  "hub": "object_creator Hub", // the hub chat's exact name: "<folder name> Hub"; unique per project
  "releases": "plain",              // "plain" (default) | "tick-tock" | "none"
  "nextRelease": 1,                 // the release the next finished work ships in
  "done": ["tests pass", "docs updated"],  // the definition of "done"
  "commitReminder": "",             // extra text shown before every commit
  "branches": { "main": "main", "release": "release" },
  "ci": { "passed": "" },           // level 2 only: shell command, $SHA set; exit 0 and print 1 if CI passed on it
  "fixes": { "toCheck": ".claude/issues-to-check.md" }, // level 2 only
  "devServer": { "command": "" }    // optional: how a chat starts its own server
}
```

Always set `hub` (suggest `<folder name> Hub`; on a re-run of an
older setup without it, add it and tell the owner to rename their hub chat).
Write only the fields that apply: leave out `ci` and `fixes` below level 2,
and `devServer` and `commitReminder` when empty.
