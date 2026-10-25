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
4. Level 2: the command that asks CI whether a commit passed. Propose one
   from what you found, e.g. `gh run list --commit $SHA --status success
   --json headSha --jq length`.

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
      `<folder name> Hub` (any name ending in "Hub" or "Manager" works).
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
  "hubSession": "",                 // the hub chat's session ID; the hub writes it itself
  "releases": "plain",              // "plain" | "tick-tock" | "none"
  "nextRelease": 1,                 // release the next finished work ships in
  "done": ["tests pass", "docs updated"],
  "commitReminder": "",             // extra text shown before every commit
  "branches": { "main": "main", "release": "release" },
  "ci": { "passed": "" },           // level 2: command with $SHA; prints 1 if CI passed
  "fixes": { "toCheck": ".claude/issues-to-check.md" }, // level 2
  "devServer": { "command": "" }    // optional
}
```

Leave out `ci` and `fixes` below level 2, and empty
optional fields.
