# Changelog (chat-hub-core, formerly chat-core)

Each version is a git tag (`v0.1.0`). Projects pin a tag in
`.claude/settings.json`, so they get a new version only when they move to it.

## 0.3.38

- **An update shows just "Updated":** after a plugin update, each open
  chat used to tell the owner about it in its own words. The prompt hook
  now hands the app a `systemMessage`, so the app itself shows one line,
  "Updated" ("Updated: restart this chat" when hooks.json changed), and
  the model still gets the note to re-read its rules file but is told to
  say nothing about the update. The hub and work-chat rules say the same.

## 0.3.37

- **Tools no chat uses are off by default:** a scan of 48 chats found
  the iOS simulator, Artifacts and the rarely used extras (groups 2, 4
  and 13–27 in `/chat-hub-core:tools`) never used, at about 15k tokens a
  chat. Every project now has them off without being asked: the start
  and prompt hooks (which run outside the chat's sandbox) add their deny
  rules to `.claude/settings.local.json` once, and record which groups
  they did in `.git/chat-hub/tools.json`, so a project already set up
  gets them on update and a new one right after setup. A group you turn
  back on (`/chat-hub-core:tools on ios`) stays on, and so does one you
  turned on before the update ran. The chat that first sees it says so
  and keeps its tools until restarted; new chats start without them. The
  list marks which groups are off by default. Setup no longer asks about
  them, only about the rest (e.g. the Browser pane with no web UI).

- **The start note says which tools are off:** a tool turned off with
  `/chat-hub-core:tools` vanishes from every chat, so a chat asked to do
  something it did couldn't tell why. When tools are off, every chat's
  start note (hub and work chats) now names them in one line (whole
  groups by name, other tools singly) and says to ask the owner to type
  `/chat-hub-core:tools on <name>`; nothing is added when none are off.
  The work-chat rules say to ask rather than work around it.

## 0.3.36

- **`/chat-hub-core:version` shows the version:** type it in any chat of
  any project to see which chat-hub-core version that project runs
  (from Claude's `installed_plugins.json`) and whether a newer one is out
  (the newest `v*` tag on GitHub, or the marketplace copy when GitHub
  can't be reached), with the update command if it is. The prompt hook
  answers it, so it costs one short reply; it works before setup too.

## 0.3.35

- **Chats set their own title symbol:** a work chat now sets its own
  status symbol (🙋 🔨 ❓ ⏳ 🚀 🟢 🔴) the moment it changes, with the
  app's rename tool on itself, changing only that first character. The
  sidebar is never behind, and the hub is no longer woken for every
  status change (one large project's hub made 701 rename calls and got
  248 status messages in a month). Chats message the hub only for new
  chats, the wrap-up report, and a merge pushed after a release. The hub
  sets only ⚪ and ✅ and the rest of the title, keeping a chat's symbol
  whenever it retitles it. If a chat's rename fails, it tells the hub the
  status as before and the hub sets it.

- **`/chat-hub-core:tools` turns off tools a project doesn't use:** every
  tool costs every chat context on every turn, the hub's most of all.
  The bare command lists every tool group a desktop-app chat gets
  (27 of them), numbered, on or off; `off 4 13-27`, `off artifacts ios`
  or `off SendUserFile` turns groups or single tools off (`off unused`:
  the rarely used extras), `on browser` (or `on all`) back on. The tools
  chat-hub-core needs always stay on. The prompt hook writes deny rules
  into the main checkout's `.claude/settings.local.json` (never
  committed; the owner's own rules are kept), which removes the tools
  from every chat, hub and work chats alike, from its next start. Setup
  now shows the numbered list, suggests what to turn off and asks. The README also says to keep `trimAt` well above the hub's
  base context (about 88k on one large project).

## 0.3.34

- **`limit.mjs` works through a symlinked path:** run by hand from a path
  that goes through a symlink (on macOS `/var` and `/tmp` are links to
  `/private/var` and `/private/tmp`, and `$TMPDIR` is under `/var`), it used to print
  nothing and change nothing. It now compares real paths to tell it was
  run directly (`isMain` in `hooks/config.mjs`), so it works from any
  path, and `tests/run.sh` no longer needs to be run from the real path
  (`cd "$(pwd -P)"`). The prompt hook's `/chat-hub-core:limit` was never
  affected.

## 0.3.33

- **`/chat-hub-core:limit` changes the context limits as you go:**
  `/chat-hub-core:limit 200k` sets the hub's wrap-up limit,
  `/chat-hub-core:limit work 100k` (or `work off`) work chats',
  `/chat-hub-core:limit` shows both and where they come from, and
  `/chat-hub-core:limit default` goes back to the settings. The prompt
  hook does it, so every chat uses the new limit from its next prompt with
  no restart. It's kept in `.git/chat-hub/limits.json` (every worktree
  sees it, never committed) and wins over `trimAt` / `trimAtWork` in
  `.claude/chat-hub.json`; without git it's written there. A hub that's
  wrapping up and is put back under its limit is told to carry on, and a
  changed limit nudges afresh once crossed.
- **Small-caps `ᴢ` for talk chats:** in release-first titles, talk chats'
  plain `Z ` is now small-caps `ᴢ ` (U+1D22), matching the release tag's
  `ʀ`: `⚪  ᴢ A4 · Compare slicers`. It still sorts after every `ʀ` chat
  among ⚪. Titles with an old plain `Z ` still count as talk chats.
  **Hub:** after this update, retitle every open talk chat from `Z ` to
  `ᴢ ` at once, in one batch of title calls, as for a renamed symbol.

## 0.3.32

- **Small-caps `ʀ` in release tags:** the release tag's letter is now
  `ʀ` (U+0280), so it stands apart from the chat code:
  `🔨  ʀ16~ A3 · Fix menu spacing`, `🔨  3F · Fix menu spacing (ʀ7)`,
  `⚪  Object Creator Hub · ʀ15 (3)`. Digits, `~` and `+` stay plain;
  chat codes, the talk-chat `Z ` and the symbols don't change. Titles
  with an old plain `R` still count as the same release (open count,
  retagging). **Hub:** after this update, retitle every open chat (and
  your own title) from `R` to `ʀ` at once, in one batch of title calls,
  as for a renamed symbol, so the sidebar never mixes the two.
- **Coming release's names in parentheses:** a chat tagged for
  `nextRelease` has its name (after the code and ` · `) in parentheses,
  so the coming release's work stands out:
  `🔨  ʀ24~ 9A · (Colour palette review)` next to
  `🙋  ʀ25+ F2 · Staging download buttons`; code first,
  `🔨  3F · (Fix menu spacing) (ʀ7)`. Talk chats and the hub's own title
  don't change. After a release the hub adds them to the chats now in
  the new coming release, in the same batch as the retag; retagging a
  chat to a later release drops them. Titles with or without them count
  the same. **Hub:** after this update, add parentheses to every open
  chat tagged for `nextRelease` at once, in one batch of title calls
  (with the `R` → `ʀ` retitle if it's still due).
- **Titles about 40 characters at most:** the whole title, symbol, tag,
  code, ` · `, name and parentheses included, so the sidebar doesn't cut
  it off. The hub shortens the name to fit when it starts or retitles a
  chat; the symbol, tag, code and parentheses are never cut.
- **❓ is back for "waiting on your answer":** symbol renamed 🤔 → ❓,
  same rules (undoes that half of 0.3.29; 🙋 for "waiting on your OK"
  stays). ❓ is a wide emoji like the others, so titles still line up.
  In release-first titles the sort order is now ⏳ ⚪ ✅ ❓ 🔨 🔴 🙋 🚀 🟢:
  ❓ moves from last to between ✅ and 🔨. Tests check that no 🤔 is
  left in the rules, README or hooks. **Hub:** after this update,
  retitle every open 🤔 chat (and your own title) to ❓ at once, in one
  batch of title calls, as for any renamed symbol.

## 0.3.31

- **Backlog:** a pointer to the parked E7 work (making the repo findable
  on GitHub, branch `parked/e7-findable`). No rule changes.

## 0.3.30

- **🤔 when a chat ends on a question:** a work chat that ended its turn
  asking the owner something in plain text could keep 🔨, so the hub
  said it was still working. Now the work chat tells the hub "question
  for owner: …" in the same turn whenever it ends on a question that
  isn't an OK, menu or not. And the hub has a backstop the other way:
  on every wake, an idle 🔨 work chat (⚪ talk chat) whose last message
  asks the owner something gets 🤔, judged from the app's note first,
  the transcript only if unsure. A closing "anything else?" and the 🟢
  "more or wrap up?" question don't count.

## 0.3.29

- **🙋 for "waiting on your OK", 🤔 for "waiting on your answer":** two
  symbols renamed, same rules. 🟡 (OK to commit, merge or push, and the
  hub's own "release built, waiting on your push") is now 🙋; ❓
  (a question that isn't an OK) is now 🤔. Both are wide emoji like the
  others, so titles still line up. In release-first titles (symbol
  first) the sort order is now ⏳ ⚪ ✅ 🔨 🔴 🙋 🚀 🟢 🤔: 🙋 moves up
  from between 🚀 and 🟢 to between 🔴 and 🚀, and 🤔 moves from
  between ✅ and 🔨 to last. Tests check that no 🟡 or ❓ is left in the
  rules, README or hooks.
- **Old symbols retitled at once:** open chats used to keep an old
  symbol until their next status change, so after a rename the sidebar
  showed 🟡/❓ next to 🙋/🤔. New hub rule (After a plugin update): when
  a release or update renames a status symbol, the hub retitles every
  open chat still showing an old one, its own title too, in one batch of
  title calls. A test checks the rule.

## 0.3.28

- **🔨 for a chat under way; ⚪ only for a new one:** ⚪ now means the
  hub just started the chat and it hasn't reported anything yet. Once
  it has, the hub sets 🔨 wherever it used to put the chat back to ⚪:
  the owner said "More changes", an OK was declined, a ❓ was answered
  (when the chat had ⚪ or 🔨 before), and the ❓ backstop. No extra
  title changes: the hub already retitles at those moments. Talk chats
  and the hub's own title keep ⚪. 🔨 is a wide emoji like the others,
  so titles still line up; in release-first titles it sorts after ❓
  and before 🔴. A test checks that no rule sends a work chat back to ⚪.

## 0.3.27

- **`trimAt` defaults to 135k** (was 150k) for every project that
  doesn't set it.
- **A cleared hub knows it's the hub:** the desktop app gives each chat
  its own address (`local_…`, unchanged by a clear) in
  `CLAUDE_CODE_HOST_SESSION_ID`. The start hook compares it with the
  recorded hub: the hub is told so outright (no "look yourself up, else
  you're a work chat"), and its new session ID is recorded for it; a
  work chat is told it's one. The prompt, guard and notes hooks know the
  hub the same way, so the WRAP UP note keeps coming right after a
  clear. The work-chat rules add: if your own address is the hub's, load
  the hub rules instead. Without the variable (plain terminal) nothing
  changes.
- **Put-off work comes first after a clear:** while wrapping up, the hub
  notes new work under `## Next` as `- After clear: …`; the start note
  quotes those lines and tells the hub to do them first.
- **No chat stuck at ⏳ across a clear:** closing a chat whose wrap-up
  report is in counts as work in flight, so the hub does it before the
  clear. A new backstop: on every wake, any ⏳/🟢 chat whose report is
  in and isn't ✅ gets closed.

## 0.3.26

- **The 🟢 "Anything more, or should I wrap up?" is a menu:** a work
  chat asks it with the AskUserQuestion tool (options "Wrap up" / "More
  changes"), like the commit OK; plain text only if the chat has no
  such tool. The hub expects the wrap-up report only after the owner
  picked "Wrap up". This is a rule with a test, not a hook: the hub can
  also start a wrap-up by message, which a hook can't tell apart, and
  the hub's close check still catches an early wrap-up.
- **🟢 always means the question is open:** the chat tells the hub the
  answer at once ("more changes, working again" → ⚪; the wrap-up report
  → ⏳), and the hub changes the symbol right away instead of keeping 🟢
  until ✅.

## 0.3.25

- **The hub's title shows how many chats are left for its release:** it
  ends in parentheses with the open chats tagged for `nextRelease` that
  aren't ✅ yet, e.g. `⚪  chat-hub-core HUB · R14 (3)`. Talk chats and
  chats for later releases don't count; `(0)` means the release's work
  is all done. The hub changes the count only in the same batch as a
  title change it's already making (starting, retagging, ✅, closing,
  after a release), so it costs no extra turns. The count is part of
  the suffix; the hub still changes only its symbol and suffix.
- **Two spaces after the status symbol in every title** (the hub's
  too), so the text clears the symbol: `⚪  R14 E6 · Hub title shows open
  chats left`, `⚪  chat-hub-core HUB · R14 (3)`.

## 0.3.24

- **The hub closes a chat in one step:** `hooks/close-chat.mjs <branch>`
  finds the chat's folder, checks it, merges the branch into the release
  preview, runs the checks on the merge, runs the close check, and prints
  READY or FAIL. The hub sets ✅ right after it, instead of spending a
  turn on each step. The preview moves only if the checks pass, and a
  clash names the files for the chat to resolve.
- **No second test run when the merge adds nothing:** when the merged
  preview has the same files as the chat's branch (the branch already had
  everything in the preview), the chat's own test run covers it, and the
  hub's run is skipped.
- **New `checks` setting (level 1+):** the command the hub runs on each
  merge into the preview (here `sh tests/run.sh`). Setup asks for it.
  Without it, `close-chat.mjs` won't say READY for a merge that adds
  something.
- `close-check.mjs --before-merge` skips the "merged" check.
- **The hub never asks about clearing:** once wrapped up at its limit, it
  starts each reply with "⚠️ Wrapped up, notes saved. Type /clear in this
  chat to clear it." and ends the turn with no question or buttons about
  clearing (in the desktop app, a recap only). A button can't clear a
  chat, and a cleared chat has nothing left to answer.

## 0.3.23

- **A third way to start a chat, "Just open":** the hub's start menu now
  offers it next to "Plan first" and "Build it". The chat reads its brief
  and rules, starts the dev server if `devServer.command` is set, says in
  one line it's ready, and waits for the owner's instructions.
  `startMode: "wait"` makes every chat start this way.
- **The hub wraps up at its limit:** past `trimAt` (default 150k) the
  hub takes on no new work (new requests go under "## Next" in
  its notes), finishes everything already in flight (a merge or release
  it started, titles it owes, replies to chats, messages it promised),
  brings its notes up to date, and only then asks to be cleared. A clear
  no longer lands in the middle of a step.
- **One level instead of three:** the repeating reminders, the last
  warning and the hard stop are gone, with the `trimEvery` and
  `trimHardStop` settings (they're ignored if still set). The note now
  comes on every prompt past the limit, and once on a tool call when the
  hub first crosses it.

## 0.3.22

- **No reminders about deleted ✅ chats:** when a chat passes the close
  check, the hub sets ✅, tells the owner once, and deletes that chat from
  `hub-notes.md` in the same step; it keeps no list of ✅ chats. The
  notes check hook now also flags any ✅ line in the notes (at hub start
  and after each hub write) and tells the hub to name it once, then delete
  it.

## 0.3.21

- **Updates reach open chats without a restart:** every hook now runs
  through a small launcher (`hooks/run.mjs`) that runs the version this
  project has installed now, not the one the chat started with (a chat
  started with `--plugin-dir` keeps its own copy). Moving to this version
  still needs one last restart of each open chat.
- **Chats reload their own rules:** after an update, on its next prompt
  each chat (hub included) is told once to read its new rules file, and
  to restart only if the update changes `hooks.json`. The hub no longer
  messages every chat to restart; `set-version.mjs` and the hub's update
  notice are gone.
- **`scripts/update-all.sh`:** updates the marketplace, then the plugin
  in every project that has it, and prints old and new versions
  (`--dry-run` to preview). Run it from the marketplace copy:
  `sh ~/.claude/plugins/marketplaces/chat-hub/scripts/update-all.sh`.
- **Releases ship with one push:** the hub tags the release and gives the
  owner `git push origin release:main vX.Y.Z` (level 2: push `release`
  first and wait for CI).
- **Ship sooner:** as soon as a finished chat is merged into the release
  preview, the hub offers "Release now" / "Wait for more".
- **Version shown:** each chat's start note and stats line now name the
  chat-hub-core version its hooks are running.

## 0.3.20

- **Hub notes stay one snapshot, not a diary:** the hub skill now says
  `hub-notes.md` is one current snapshot under fixed headings (`## Me`,
  `Next`, `Shipped`, `Preview`, `Waiting`, `Open chats`, `Plans`,
  `Gotchas`), edited in place: no dated, "Latest" or checkpoint blocks,
  only the last 2 releases, closed chats deleted. A hook checks it at hub
  start and after every hub write to the notes: other `## ` headings, or a
  file over `notesMaxBytes` (default 6000; 0 = off), tell the hub to
  rewrite them first. New PostToolUse hook `notes-check.mjs`.
- **The commit OK is a menu:** a work chat asks for it with a clickable
  menu ("Yes, commit" / "Not yet"), not a typed question. The guard hook
  refuses a work chat's commit unless its transcript shows a menu yes
  about committing since its last commit (a typed yes, or another
  chat's message, doesn't count). Finishing a merge is exempt; setting
  `"okMenu": false` turns the check off for chats with no menu tool.
- **❓ no longer goes stale:** when you answer a chat's question in that
  chat, it tells the hub "answered, working again" and the hub puts back
  the earlier symbol. As a backstop, the hub sets ⚪ on any ❓ chat the
  app shows as working.

## 0.3.19

- **Louder trim reminder:** it now starts "⚠️ STOP: trim reminder N",
  says what happens next, and gives the chat a line to put at the top of
  every reply until it's cleared, not just once.
- **Last warning, then a hard stop, for the hub:** after `trimHardStop`
  reminders past the limit (default 2: 200k with the defaults; 0 = off)
  the hub gets a last warning to finish only the step in progress and save
  its notes. One step later (225k) the guard hook
  refuses every tool for the hub except reading, read-only shell commands
  and writing its hub notes, and every prompt tells it to answer only
  "⛔ Notes saved, please clear this chat." Clearing lifts it. Work chats
  get the louder reminder but no hard stop: they'd lose work mid-task.
- The guard hook now runs on every tool, not just shell commands and edits.
- Before starting each chat, the hub asks you how it starts: **plan
  first** (it sends a short plan and waits for your go, ❓) or **build
  it** (straight to work, stops only for the commit OK). Optional
  setting `startMode`: "ask" (default), "plan" or "build". The brief
  carries a **Start:** line.

## 0.3.18

- After pushing (level 2: after CI passes), a work chat asks you
  "Anything more, or should I wrap up?"; 🟢 now means exactly that. "More"
  sets ⚪, which now means "working, nothing waiting on you". It wraps up only when you say so; the hub merges it into the
  release preview only once the report is in, then sets ✅.
- The hub sets its own title symbol during a release: 🟡 built, 🚀 in CI,
  🟢 passed, 🔴 failed, ❓ question, ⚪ once main has it.
- README: flowcharts of the chat and release symbols.

## 0.3.17

- New title symbol ❓: the chat stopped on a question for you that isn't
  a commit/merge/push OK (that stays 🟡). The hub sets it from the app's
  "waiting on the user" note or from the chat's "question for owner: …"
  line, and puts the old symbol back once you answer. Talk chats get it too.
- README: one table of every title symbol, what it means, when it's set
  and at which level.
- README opens with headline features, a status-symbol legend and an
  example sidebar, with levels up front; details follow.
- Dropped the `***` marker for chats still tagged with a shipped release
  (the hub retags them instead).

## 0.3.16

- New title symbol ⏳ between your OK and the push landing: when you say
  yes, the work chat tells the hub before committing ("OK given,
  committing") and the hub swaps 🟡 for ⏳; after the push it sets 🚀
  (level 2) or 🟢 (level 1).
- New title symbol 🟢: CI passed (level 2), or pushed with nothing
  pending (level 1). ⚪ now means only a new chat that hasn't pushed yet;
  after a push or a declined OK a chat that has pushed shows 🟢, not ⚪.
  Talk chats and the hub keep ⚪.

## 0.3.15

- Title symbols swapped: 🟡 now means waiting on the owner's OK (was 🚀,
  like a yellow light) and 🚀 means a push is in CI, "in flight" (was 🟡).
  🔴, ✅ and ⚪ are unchanged.

## 0.3.14

- **Titles line up:** work chats with no status symbol get `⚪`, so every
  title starts with a symbol and the text forms a column (the app trims
  blank stand-ins). Talk chats and the hub get it too. Release-first
  titles now group by symbol first.
- **🚀 marks chats waiting on your OK:** when a work chat asks to commit,
  merge or push, it tells the hub, which puts 🚀 at the start of its
  title; the hub clears it once the chat pushes or you say no.

## 0.3.13

- **Running chats hear about updates:** the hub notices when the installed
  chat-hub-core version changes (checked on each of its prompts) and
  messages open work chats once: what changed, and how to restart
  (terminal: exit, then `claude --continue`; desktop app: quit and reopen).
  A restarted chat keeps its conversation and reloads its rules.
  `hooks/set-version.mjs` records the version once they're told. Needs git;
  skipped without it, and silent if Claude's plugin list can't be read.
- **Close check works without an upstream:** chats can't set one (the
  sandbox blocks writing `.git/config`), so "pushed" now falls back to
  `origin/<branch>`: it passes if that contains HEAD and says how many
  commits aren't pushed if not. Work chats push with a plain
  `git push origin HEAD` (no `-u`).

## 0.3.12

- **The trim reminder repeats:** past the limit, a chat is reminded again
  every `trimEvery` tokens (default 25k: 150k, 175k, 200k…), and each
  reminder says how far over it is. It used to come only once.

## 0.3.11

Token use (from object_creator: the hub was about 3/4 of all spend,
re-reading ~450k tokens every turn):
- **The commit reminder fires only on `git commit`** (it appeared on every
  command, adding to every turn's context).
- **A stats line after every turn**, for the owner only: context size,
  turns, and token-reads so far (`stats: false` hides it).
- **Self-trim:** past `trimAt` (default 150k, hub only; `trimAtWork` for
  work chats) a chat is told once to update its notes and ask the owner to
  clear it.
- **Hub rules for cheaper turns:** change titles only on real status
  changes and batch them; never sleep-poll; read parts of files.
- `scripts/all-prompts.sh` rebuilds `docs/all-prompts.md` (it used to live
  outside the repo).

## 0.3.10

From object_creator, tried there by hand first:
- **Only the hub sets status symbols** (🟡 🔴 ✅). Work chats never change
  their own titles (they kept overwriting the hub's); they tell the hub
  when they push and how CI ended. Reverses 0.3.5's "pushing chat sets its
  own mark".
- **After a release, merge main at once, push it with the next change**
  (unless the work is finished and waiting for a release: then push at
  once). Ten chats pushing bare merges queued CI for an hour.
- **Re-read CLAUDE.md after merging main;** a running chat only read it at
  the start. The hub states new rules in its "merge main" message.
- **Merge main with the app's "sync with base branch" tool** when there is
  one: it runs outside the sandbox, so merges touching `.claude/…` don't
  fail half-way. Merging the release preview still needs the owner.

## 0.3.9

- **Closing a chat is checked, not trusted.** The chat sends a wrap-up
  report in a fixed shape (commit, each `done` item with what it ran,
  follow-ups, anything open) and never calls itself ready. The hub runs
  `hooks/close-check.mjs <folder>`: nothing uncommitted; level 1+ on its
  own branch, pushed, and merged into the release preview; level 2 CI
  passed and no fix still waiting for the owner's check. Only then ✅. The
  owner archives; the hub never does.
- **`followups` setting:** the one file chats write follow-ups to (setup
  asks; default `docs/backlog.md`).

## 0.3.8

Pulled in from object_creator's hub:
- **Status symbols** first in titles: 🟡 push in CI, 🔴 CI failed, ✅ ready
  to close (replacing `! `, `(!)` and `(Ready to close)`). The pushing chat
  sets 🟡/🔴; the hub sets ✅.
- **Talk chats** for questions, research and planning: no release tag, no
  branch; `Z ` first in release-first titles so they sort last.
- **Hub notes** in `.git/chat-hub/hub-notes.md`, kept current by the hub;
  the start note tells a starting hub to read them first.
- Release notes list included chats as `- **Title** (CODE, `branch`)`.
- If CI can't run at all, the hub asks the owner whether to merge on the
  jobs that passed. If its sandbox blocks a merge, it gives the owner the
  command.
- Work chats drive only their own browser tab, by its tab ID.

## 0.3.7

- The hub's title shows only the soonest next release (`· R15+`), not one
  of each kind.
- `(Ready to close)` goes at the very start of a chat's title, so those
  chats sort to the top.

## 0.3.6

- **Hard stops for rules that used to rely on memory** (a new guard hook;
  level 1+ unless noted): a work chat can't commit on the main branch;
  nobody can rebase; a work chat can't edit files in another chat's
  worktree; and (any level) a work chat's commit message must start with
  its code (`3F: …`). The hub is exempt where releases need it.
- **The hub's own title:** it no longer renames or suggests renaming
  itself; it only adds the next release as a suffix
  (`Object Creator Hub · R15`, or `· R15+ R16~` with tick-tock) and keeps
  that current.
- **Stops loudly instead of guessing:** a broken settings file is reported
  in every chat; with no hub recorded, chats tell the owner instead of
  guessing a hub by name; a work chat that can't reach its hub stops and
  says so; `/chat-hub-core:hub` in a second chat refuses while another is
  recorded (type `/chat-hub-core:hub replace` to switch; `set-hub.mjs`
  takes `--replace`).
- **Setup picks the hub:** its last step asks "make this chat the hub?"
  (default yes) and records it, so a project never runs without one.
- **Release-first titles** (setting `titles: "release-first"`):
  `R16~ A3 · Fix menu spacing`, release padded to two digits, so an
  alphabetical sort groups chats by release. The in-CI mark is `(!)` after
  the code there. The default stays `3F · Title (R7)`.

## 0.3.5

- **The hub is recorded by two IDs:** Claude's session ID and the desktop
  app's address (`local_…`). Work chats message the app address (the
  session ID couldn't be messaged), and a hub that restarts or is cleared
  recognises itself instead of loading the work-chat rules.
  `set-hub.mjs --session <id> --app <local_…>`; older records still work.
- **The chat that pushes manages its own `! `** (level 2): it adds it when
  CI starts and removes it when the run ends. The hub only checks titles.

## 0.3.4

- The hub's session ID is kept in git's shared folder (`.git/chat-hub/hub`),
  so every chat and worktree sees it at once instead of after a release.
  `/chat-hub-core:hub` records it through a hook, which works from a
  sandboxed chat; `hooks/set-hub.mjs` does the same by hand.
  `hubSession` in the settings still works, as the fallback without git.
- Each chat's start note includes its own session ID.
- The push guard tells "CI hasn't passed" apart from "couldn't ask CI"
  (expired token, no network) and shows the command's own error. A
  `ci.passed` command must print `1` or `0`, and fail when it can't ask:
  if yours prints `0` on errors, make it exit non-zero instead.
- Hubs with the same name in different projects: with no hub recorded, a
  chat checks a candidate's folder and asks the owner if unsure; work
  chats message the hub by session ID only; the hub suggests a
  project-named title (`cns Hub`).

## 0.3.3

- New plugin description.

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
