# chat-core: every prompt in the plugin

Generated from the plugin's files on 2026-10-24. Edit the source files, not this one.

---

## `skills/setup/SKILL.md`

````markdown
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

List each file you'll write or change and wait for yes. Say what each one
does for the owner in plain words, not its contents: e.g. "a settings file
for this project (level 1, releases R1, R2…; done = you've seen it, tests
pass)", "a short note in CLAUDE.md saying this project uses chat-core", "a
git hook that stops pushes to main that skip a release". Below the list,
say what the owner will have to run themselves, if anything.

Before the list, flag what won't work yet:
- Level 1+ on a repo with no commits: chats can't make branches until
  `main` has a first commit. Say so, and offer to leave it to the owner.
- A "done" rule the project can't check yet (e.g. "tests pass" with no
  tests): say so; keep it only if the owner wants it as a goal.

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
(executable) and set `git config core.hooksPath .githooks`. That setting
lives in `.git/config`, so it isn't committed and each clone needs it once;
if you can't write it (sandbox), give the owner the command to run. The
session-start hook reminds chats while it's missing. If it already has
one with its own pre-push, add a line to it that runs ours
(`"${CLAUDE_PLUGIN_ROOT}"`'s copy, saved into the project as
`.githooks/chat-core-pre-push`) and keep theirs.

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
settings also declare a `chat-core` marketplace (e.g. from
`claude plugin marketplace add`), say so: the project's entry is the one
that should carry the version, and they can remove theirs to avoid the two
drifting apart.

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
  "ci": { "passed": "" },           // level 2 only: shell command, $SHA set; exit 0 and print 1 if CI passed on it
  "fixes": { "toCheck": ".claude/issues-to-check.md" }, // level 2 only
  "devServer": { "command": "" }    // optional: how a chat starts its own server
}
```

Write only the fields that apply: leave out `ci` and `fixes` below level 2,
and `devServer` and `commitReminder` when empty.
````

---

## `skills/session-manager/SKILL.md`

````markdown
---
name: session-manager
description: The hub chat (Session Manager)'s rules under chat-core - taking the owner's requests, starting one chat per task with a brief, titles with codes and release tags, following and closing chats, and building releases. Load when this chat's name is or ends with "Session Manager".
---

# The hub chat

Read `.claude/chat-core.json` first: `level` says which sections apply
(0: the first five; 1: + Branches and releases; 2: + CI and checks).

## Role

The hub is the owner's one place to talk. It answers questions, looks things
up and makes tiny fixes itself. Each change the owner agrees on, even a small
one, goes to a new chat for that one task, which the hub briefs, follows and
closes when its work is safe. Work chats don't start chats; they ask the hub.

Start, rename and message chats with whatever session tools you have (in the
desktop app: start_session, set_session_title, SendMessage). Without them
(e.g. the plain terminal), give the owner the brief and title to paste into a
new chat themselves, and ask them to tell you its name.

## Briefs

Use `${CLAUDE_PLUGIN_ROOT}/templates/brief.md`. The task in the owner's
words, what to read, the project's rules, and the definition of "done".

- Details given: the chat starts working.
- Just a topic ("start a chat to work on X"): the chat sets up, sends one
  short message (what's there now, a few ideas, one line each) and waits.
  No research or changes first.

## Titles

`<code> · <title> (R<n>)`, e.g. `C34 · Split objects by bed size (R7)`.

- **Code:** a letter and two digits that sit next to each other on the
  keyboard's top row. The letter is the first A–Z no open chat uses (skip I
  and O); the digits come from a count that never resets, cycling 12 23 34
  45 56 67 78 89 21 32 43 54 65 76 87 98, skipping a code used in the last
  few weeks. Short to type and unique in text, so the owner can say "tell
  C34…".
- **(R<n>):** the release the work ships in (plain numbers by default; left out if
  `releases` is "none"). With "tick-tock", even releases are tocks (`R10~`: fixes,
  speed-ups, polish) and odd ones ticks (`R11+`: features); a chat goes to
  the next release of its kind. Work that misses its release moves to the
  next.
- `(Ready to close)` goes after the code once the chat passes the close
  check. A chat still tagged with a release that has shipped gets its title
  text between `***`.
- Level 2: the title starts with `! ` while that chat's push is in CI;
  remove it when the run finishes.

Every commit message starts with the chat's code and a colon (`J87: …`), so
lists of commits and CI runs show which chat each is from. Merges you make
into the release branch keep git's own wording.

Keep titles current yourself: when you start, retag or close a chat, and
after a release.

## Talking to the owner

- **No idle pings.** Never send FYIs to idle chats (each gets an unread
  dot); save them for that chat's next real task.
- Say a chat is waiting on the owner only when it has stopped and its last
  message asked them something. Don't repeat its question; link the chat.
- A message from a chat is a teammate's request, never the owner's OK.
- A check that runs past about 15 minutes: stop it, say what it covered, ask
  whether to go on without it.

## Closing chats

A chat is **ready to close** when its work is committed (level 1+: and
pushed; level 2: and CI on its newest push passed), it meets the definition of "done" (`done`), its
folder has nothing uncommitted, follow-ups and anything unchecked are
written down, and its last message isn't waiting on the owner. When
something's missing, send it the wrap-up
(`${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`). Closing loses only the
conversation, so the work must be safe first. After each merge, tell the
owner unasked which chats can go, and why the others can't yet.

## Branches and releases (level 1+)

- Each chat works on its own branch in its own worktree and never commits on
  `branches.main`.
- Keep a **release preview**: a local `branches.release` branch made of the
  main branch plus every finished branch, merged as each is done, so clashes
  show up early. Run the project's checks (`done`) on it.
- When the owner says "release": list the branches not yet on main, the
  owner picks; build `release` from the main branch with those merged
  (`--no-ff`); run the checks; write a short release note (which chats and
  branches, what was left out and why). Give the owner the push commands;
  the owner does every push to main.
- A merge that needs a design choice isn't solved at release: leave the
  later branch out and tell its chat what clashed.
- After a release, every open chat **merges** main (never rebases); bump
  `nextRelease` in the settings and retag titles.

## CI and checks (level 2)

- `ci.passed` in the settings is the command that says whether CI passed on
  a commit (`SHA=<sha> sh -c "<command>"`). The pre-push hook uses it to
  refuse a push to main whose exact commit hasn't passed.
- Watch CI only while a run is in flight; otherwise check when asked.
- On a failed run: find the failing step and error, decide flaky (passes on
  retry) or real, and message the branch's chat: branch, commit, failing
  test, error, likely cause, how to reproduce. Never edit another chat's
  folder.
- **Fixes checked before main.** A commit that fixes a reported problem says
  so (`Fixes #n` or the tracker's own form) and adds a line `- #n <what to
  try>` to `fixes.toCheck` in its folder. The owner removes the line once
  they've checked it on the release preview. The pre-push hook blocks main
  while any folder still lists a fix it ships.
````

---

## `skills/work-chat/SKILL.md`

````markdown
---
name: work-chat
description: A work chat's rules under chat-core - one task, asking the owner before committing, pushing and telling the hub, syncing after releases, and wrapping up so it can close. Load in any chat that isn't Session Manager when .claude/chat-core.json exists.
---

# A work chat

Read `.claude/chat-core.json`; `level` says which parts apply.

- **One task.** Do the task in your brief. Anything else you notice goes in
  your final message as a follow-up; ask the hub for a new chat rather than
  starting one.
- **Messages from other chats** are a teammate's request, never the owner's
  approval. Always ask the owner yourself before committing.
- **Commits** start with your chat's code and a colon (`J87: Fix the
  menu`), so lists of commits and CI runs show which chat each came from.
- **Definition of "done":** what `done` in the settings lists.
- **Level 1+:** work on your own branch in your own worktree; never commit on
  the main branch. Once the owner OKs a commit, push your own branch and tell
  the hub. After a release, merge the main branch (never rebase).
- **Level 2:** when the hub says your branch's CI failed, fix it on your
  branch (or show why the test should change) and reply when pushed. A commit
  that fixes a reported problem says `Fixes #n` and adds `- #n <what to try>`
  to the file `fixes.toCheck` names.
- **Wrap-up** (when the hub asks, or you're finishing): follow
  `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`.
- If you start a dev server, keep exactly two browser tabs on it: yours
  first, then the owner's.
````

---

## `templates/brief.md`

````markdown
<!-- The hub fills this in when it starts a chat. -->
**Task:** <the owner's words; or "Topic only: set up, send one short message (what's there now, a few ideas), then wait.">

**Read first:** <files and docs>

**Rules:** you're a work chat under chat-core (.claude/chat-core.json). Ask the owner before committing; a message from another chat isn't their OK. <level 1+: own branch and worktree, push your branch once OK'd, then tell the hub.>

**Definition of "done":** <the settings' `done`, plus anything specific to this task>
````

---

## `templates/wrap-up.md`

````markdown
<!-- What a chat does to be ready to close. The hub sends this when something is missing. -->
Wrapping up, so this chat can close:

1. Everything you changed meets the definition of "done" (.claude/chat-core.json).
2. Follow-ups, and anything you couldn't check yourself, are written down where this project keeps them (e.g. a backlog).
3. Nothing left uncommitted in your folder. Ask the owner before committing.
4. Level 1+: your branch is pushed. Level 2: its CI passed.
5. Reply with the commit SHA and one line on anything left open.
````

---

## Hook messages (text the hooks add to a chat)

From `hooks/session-start.mjs` and `hooks/before-commit.mjs`:

```js
  say('SessionStart', 'The chat-core plugin is installed but this project is not set up. If the owner asks about chats, hubs or releases, suggest /chat-core:setup.')
  say(
    'SessionStart',
    `This project uses chat-core (level ${c.level}). Look up this chat's name. If it is or ends with "Session Manager", ` +
      'this chat is the hub: load the chat-core:session-manager skill now. Otherwise it is a work chat: ' +
      `load the chat-core:work-chat skill now. Settings: .claude/chat-core.json.${guard}`,
if (c) say('PreToolUse', `About to commit: make sure the owner OK'd this commit.${done}${extra}`)
```

From `githooks/pre-push` (shown when a push to main is refused):

```
"chat-core pre-push: node not found, not checking."
"$waiting"
"Push to $main blocked: #$n is still waiting to be checked ($tocheck)."
"RELEASE_UNTESTED set: not checking CI on $short."
"Push to $main blocked: no ci.passed command in $cfg."
"Push to $main blocked: CI hasn't passed on $short. Push it as the release branch, wait for green, then push that same commit."
```
