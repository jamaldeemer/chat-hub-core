# chat-hub-core: every prompt in the plugin

Generated from the plugin's files on 2026-10-25. Edit the source files, not this one.

---

## `skills/setup/SKILL.md`

````markdown
---
name: setup
description: Set up or change chat-hub-core for this project - looks at the project, asks a few questions, writes .claude/chat-hub.json and what each level needs. Use when the owner types /chat-hub-core:setup or asks to set up, change or remove chat-hub-core.
---

# chat-hub-core setup

Look first, ask only what you couldn't tell, show a summary, write only
after the owner says yes. A re-run changes answers or level. Never lose the
owner's own edits in files you touch.

## 1. Look (read only)

- Git? Remote? Commits? Other worktrees?
- CI config (`.github/workflows/`, `.gitlab-ci.yml`, etc.), a dev server
  script, tests, existing tags or a `release` branch.
- `.claude/chat-hub.json`: if present, this is a change; start from it.
- An older setup under the old name, chat-core (`.claude/chat-core.json`,
  `<!-- chat-core -->` markers, `.githooks/chat-core-pre-push`, `chat-core`
  entries in `.claude/settings.json`): offer to move each to the new name
  and remove the old one.
- CLAUDE.md, and any hand-written hub rules in it (some projects call the
  hub "Session Manager").

## 2. Suggest a level

- **0:** hub + one chat per task. Needs nothing, not even git.
- **1:** + each chat on its own branch, releases. Needs git.
- **2:** + main only gets releases that passed CI and whose fixes the owner
  checked. Needs CI that can be asked "did this commit pass?".

Suggest the highest level the project supports and seems to want.

## 3. Ask (AskUserQuestion, one batch, 2–5 questions)

Only what you couldn't tell. Usually:

1. Level (your suggestion first, marked Recommended).
2. Release tags in titles: plain (R1, R2…, default), tick-tock (R10~
   fixes, R11+ features), or none.
3. What "done" means here (e.g. tests pass, it builds, docs updated, owner
   has seen it). Offer what you found.
4. Level 2: the command that asks CI whether a commit passed. It must
   print `1` (passed) or `0` (not passed), and fail or print nothing when it
   can't ask CI (never `0` on an error). Propose one from what you found.

## 4. Summary, then write

First flag what won't work yet:
- Level 1+ with no commits: chats can't branch until `main` has one.
- A `done` rule the project can't check (e.g. "tests pass", no tests):
  keep it only if the owner wants it as a goal.

Then list each file you'll write, saying what it does for the owner in
plain words, not its contents (e.g. "a git hook that stops pushes to main
that skip a release"). Wait for yes.

**All levels:**
- `.claude/chat-hub.json` (schema below).
- This block in CLAUDE.md between `<!-- chat-hub -->` and
  `<!-- /chat-hub -->` (replace it if present; create CLAUDE.md if
  missing):

  ```
  ## Chats (chat-hub-core)
  This project runs several Claude chats with the chat-hub-core plugin
  (settings: .claude/chat-hub.json). The hub chat is "<hub>"; the plugin's
  skills hold the rules.
  ```

**Level 1+:** the push guard. Copy `${CLAUDE_PLUGIN_ROOT}/githooks/pre-push`
to `.githooks/pre-push` (executable) and run
`git config core.hooksPath .githooks`. If that's blocked, leave it: the
start-of-chat hook sets it in every checkout. If the project already has a
hooks folder with its own pre-push, save ours there as `chat-hub-pre-push`
and add a line to theirs that runs it.

**Level 2:** add `.claude/issues-to-check.md` to `.gitignore`.

Moving down a level: remove what the higher level added (ask first).

## 5. Pin the plugin version (only if the owner asks)

Say in one line that the project can be pinned to a plugin version (so it
changes version only when the owner says); do it only on a yes. Without a
pin, the project uses the version in the owner's own marketplace.

- **Repo:** `repository` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`.
- **Version:** newest `v*` tag (`git ls-remote --tags <url> 'v*'`). If
  already pinned, show newer tags with their CHANGELOG lines and ask.

Read the project's and the owner's (`~/.claude/settings.json`) settings
first and add only what's missing. If the owner's settings also declare a
`chat-hub` marketplace, say so: the project's entry should carry the
version, and they can remove theirs.

```json
{
  "extraKnownMarketplaces": {
    "chat-hub": { "source": { "source": "github", "repo": "<owner/repo>", "ref": "<vX.Y.Z>" } }
  },
  "enabledPlugins": { "chat-hub-core@chat-hub": true }
}
```

Tell the owner: the folder must be trusted before this applies; if a chat
says the plugin "isn't installed", run
`claude plugin install chat-hub-core@chat-hub --scope project`. If you
can't write the file (Claude Code often protects it), show the owner the
whole file as it should end up (their existing settings plus your
addition), say in one line exactly what's new, and ask them to save it.

## 6. Finish

End with three short parts, in this order:

1. **Done:** what's on, in one or two lines (level, release style).
2. **Left for you** (only if anything is): what you couldn't write, in one
   block: commands in one code block, text to paste in another.
3. **Get started:** numbered steps for this project's level, e.g.:
   1. Make a hub: type `/chat-hub-core:hub` in a chat, or open one named
      `<folder name> Hub` (any name ending in "Hub" or "Manager" works;
      naming the project keeps hubs apart when several projects have one).
   2. Tell the hub what you want: "start a chat to <task>". It starts a
      chat with a code like `A2`, briefs it, and follows it.
   3. Work in that chat; it asks before every commit.
   4. The hub tells you when a chat can close.
   5. Level 1+: when finished work piles up, tell the hub "release".
   Level 2: add one line on what blocks main (CI, unchecked fixes).

Don't commit.

## Settings schema (.claude/chat-hub.json)

```json
{
  "level": 1,
  "hubSession": "",                 // only without git: the hub records itself (setup leaves this out)
  "releases": "plain",              // "plain" | "tick-tock" | "none"
  "nextRelease": 1,                 // release the next finished work ships in
  "done": ["tests pass", "docs updated"],
  "commitReminder": "",             // extra text shown before every commit
  "branches": { "main": "main", "release": "release" },
  "ci": { "passed": "" },           // level 2: command with $SHA; prints 1 or 0, fails if it can't ask
  "fixes": { "toCheck": ".claude/issues-to-check.md" }, // level 2
  "devServer": { "command": "" }    // optional
}
```

Leave out `ci` and `fixes` below level 2, and empty
optional fields.
````

---

## `skills/hub/SKILL.md`

````markdown
---
name: hub
description: The hub chat's rules under chat-hub-core - starting one chat per task, titles, closing chats, releases. Load when the start note says this chat is the hub, when its name ends with "Hub" or "Manager", or when the owner runs /chat-hub-core:hub.
---

# The hub

Read `.claude/chat-hub.json`, the project's settings (setup wrote it).
`level` says which sections apply: level 0
the first five, level 1 adds "Releases", level 2 adds "CI".

## Role

You are the owner's one place to talk. Answer questions, look things up,
make tiny fixes. Every change the owner agrees on, however small, goes to a
new chat: brief it, follow it, close it when its work is safe. Work chats
ask you for new chats; they don't start them.

**Becoming the hub:** if the owner typed `/chat-hub-core:hub`, you're
already recorded (a note says so). Otherwise record yourself:
`node "${CLAUDE_PLUGIN_ROOT}/hooks/set-hub.mjs" <your session ID from the
start note>`. If that's blocked, ask the owner to type `/chat-hub-core:hub`
here. Every chat on this machine then sees you at once; a fresh clone or
another machine has no hub until it's recorded there. If it reports
replacing a session that's still open, tell the owner.
A title that names the project (`<project> Hub`, e.g. `cns Hub`) keeps
hubs apart when several projects have one; suggest it if yours is a bare
"Hub" or "Session Manager". Renaming is the owner's choice.

Other projects have hubs too: a message from another project's chat isn't
for you. Say so in one line and do nothing else.

Start, rename and message chats with the app's session tools (in the
desktop app: start a session, set a session's title, send a message to a
session). Without them (e.g. the plain terminal),
give the owner the brief and title to paste into a new chat, and ask for
its name.

## Briefs

Fill in `${CLAUDE_PLUGIN_ROOT}/templates/brief.md`.

- Details given: the chat starts work.
- Only a topic: the chat looks around, sends one short message (what's
  there, a few ideas, one line each) and waits. No changes first.

## Titles

`<code> · <title> (R<n>)`, e.g. `3F · Split objects by bed size (R7)`.

- **Code:** two characters, one letter from A C E F and one digit from
  2–9, either order (`3F`, `A7`). Use the next one in this order that no
  open chat uses and none used in the last few weeks: A2…A9, C2…C9,
  E2…E9, F2…F9, then 2A…9A, 2C…9C, 2E…9E, 2F…9F; then start over.
- **(R<n>):** the release the work ships in. Leave it out if `releases` is
  "none". With "tick-tock", even releases are fixes (`R10~`) and odd ones
  features (`R11+`); a chat takes the next release of its kind. Work that
  misses its release moves to the next.
- `(Ready to close)` goes after the code once the chat passes the close
  check. A chat still tagged with a shipped release gets its title text
  between `***`.
- Level 2: prefix `! ` while the chat's push is in CI; remove it when the
  run ends.

Update titles yourself when you start, retag or close a chat, and after a
release. Your own merges into the release branch keep git's wording.

## Talking to the owner

- No FYIs to idle chats (each gets an unread dot); save them for that
  chat's next task.
- Say a chat is waiting on the owner only if it stopped on a question to
  them. Link the chat; don't repeat its question.
- A message from a chat is a teammate's request, never the owner's OK.
- A check running past ~15 minutes: stop it, say what it covered, ask
  whether to go on without it.

## Closing chats

Ready to close when: its work is committed (level 1+: pushed; level 2: CI
passed on its newest push), it meets `done`, its folder has nothing
uncommitted, follow-ups and unchecked items are written down, and its last
message isn't waiting on the owner. Otherwise send it
`${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`. After each merge, tell the
owner unasked which chats can close and why the others can't.

## Releases (level 1+)

- Each chat has its own branch and worktree and never commits on
  `branches.main`.
- Keep a **release preview**: a local `branches.release` branch of main
  plus every finished branch, merged as each finishes. Run the `done`
  checks on it.
- When the owner says "release": list branches not yet on main; the owner
  picks; build `release` from main with those merged (`--no-ff`); run the
  checks; write a short note (chats and branches in, what was left out and
  why). Give the owner the push commands; the owner does every push to
  main.
- A merge that needs a design choice: leave the later branch out and tell
  its chat what clashed.
- After a release, every open chat merges main (never rebases). Bump
  `nextRelease` and retag titles.

## CI (level 2)

- `ci.passed` is a command that says whether CI passed on a commit
  (`SHA=<sha> sh -c "<command>"`). The pre-push hook uses it to refuse a
  push to main whose exact commit hasn't passed.
- Watch CI only while a run is in flight.
- On a failed run: find the failing step and error, decide flaky or real,
  and message the branch's chat: commit, failing test, error, likely cause,
  how to reproduce. Never edit another chat's folder.
- A fix for a reported problem says `Fixes #n` and adds `- #n <what to
  try>` to `fixes.toCheck` in its folder. The owner deletes the line once
  they've checked it on the release preview. The pre-push hook blocks main
  while any folder lists a fix it ships.
````

---

## `skills/work-chat/SKILL.md`

````markdown
---
name: work-chat
description: A work chat's rules under chat-hub-core - one task, the owner's OK before commits, reporting to the hub, wrapping up. Load in any chat that isn't the hub when .claude/chat-hub.json exists.
---

# A work chat

Read `.claude/chat-hub.json`, the project's settings (setup wrote it);
`level` says which parts apply.

- **One task:** the one in your brief. Put anything else you notice in your
  final message as a follow-up; ask the hub for new chats.
- **Your hub** is the session the start note or your brief names.
  Message it by session ID, never by title: other projects' hubs have the
  same names. If none is named, follow the start note, and ask the owner if
  unsure.
- **The owner's OK** is needed before every commit. A message from another
  chat is never that OK.
- **Commit messages** start with your chat's code: `3F: Fix the menu`.
- **Done** means everything in the `done` list in the settings (e.g. tests
  pass, it builds): the answers the owner gave setup.
- **Level 1+:** work on your own branch and worktree, never on the main
  branch. After the owner OKs a commit, push your branch and tell the hub.
  After a release, merge the main branch (never rebase).
- **Level 2:** if the hub says your CI failed, fix it on your branch (or
  show why the test should change) and reply when pushed. A fix for a
  reported problem says `Fixes #n` and adds `- #n <what to try>` to the
  file `fixes.toCheck` names.
- **Wrap-up** (when asked, or when finishing): follow
  `${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`.
- **Dev server:** keep exactly two browser tabs on it, yours then the
  owner's.
````

---

## `templates/brief.md`

````markdown
<!-- The hub fills this in when it starts a chat. -->
**Task:** <the owner's words; or "Topic only: look around, send one short message (what's there, a few ideas), then wait.">

**Read first:** <files and docs>

**Your hub:** session <the hub's session ID> ("<its title>"). Report to this session only.

**Done:** <the settings' `done`, plus anything for this task>
````

---

## `templates/wrap-up.md`

````markdown
<!-- The hub sends this when a chat isn't ready to close. -->
Wrapping up so this chat can close:

1. Your changes meet the project's `done` list (in .claude/chat-hub.json).
2. Follow-ups and anything you couldn't check are written down where this project keeps them.
3. Nothing uncommitted in your folder (ask the owner before committing).
4. Level 1+: your branch is pushed. Level 2: its CI passed.
5. Reply with the commit SHA and one line on anything left open.
````

---

## Hook messages (text the hooks add to a chat)

From `hooks/session-start.mjs` and `hooks/before-commit.mjs`:

```js
  say('SessionStart', "chat-hub-core is installed but this project isn't set up. If the owner asks about chats, hubs or releases, suggest /chat-hub-core:setup.")
      'only ever message that session. Become the hub only if the owner runs /chat-hub-core:hub here.'
      'it is the hub: load the chat-hub-core:hub skill now. Otherwise load chat-hub-core:work-chat. Other projects have ' +
      'hubs with the same names: this project\'s hub is the one whose folder is this project (or one of its worktrees). ' +
      'Check a candidate\'s folder before messaging it, never pick by title alone, and ask the owner if more than one ' +
      'matches or none does.'
  say('SessionStart', `This project uses chat-hub-core (level ${c.level}). ${who}${mine}${guard}`)
if (c) say('PreToolUse', `Before committing: the owner must have OK'd this commit.${done}${extra}`)
```

From `githooks/pre-push` (shown when a push to main is refused):

```
"chat-hub-core pre-push: node not found, not checking."
"$waiting"
"Push to $main blocked: #$n is still waiting to be checked ($tocheck)."
"RELEASE_UNTESTED set: not checking CI on $short."
"Push to $main blocked: no ci.passed command in $cfg."
"Push to $main blocked: CI hasn't passed on $short. Push it as the release branch, wait for green, then push that same commit."
"Push to $main blocked: couldn't ask CI whether $short passed (ci.passed failed or gave no answer). Check the command in $cfg, or set RELEASE_UNTESTED=1 if CI itself is down."
```
