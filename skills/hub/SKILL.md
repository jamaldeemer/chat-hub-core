---
name: hub
description: The hub chat's rules under chat-hub-core - starting one chat per task, titles, closing chats, releases. Load when the start note says this chat is the hub, or when the owner types /chat-hub-core:hub here and it is recorded.
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

**Becoming the hub:** record yourself by both IDs: your session ID (in the
start note) and your app address (this session's own id from the app's
session tools, starting `local_`; work chats message you there, and it
survives a restart or clear):
`node "${CLAUDE_PLUGIN_ROOT}/hooks/set-hub.mjs" --session <session ID> --app <local_…>`.
If the owner typed `/chat-hub-core:hub`, your session ID is already
recorded; add `--app` alone. If the command is blocked, ask the owner to
type `/chat-hub-core:hub` here, then add `--app`. If it says another chat
is already the hub, you are not the hub: tell the owner which chat it
names, and add `--replace` only if they say to. Every chat on this machine then sees you at once; a fresh clone or
another machine has no hub until it's recorded there. If it reports
replacing a session that's still open, tell the owner.
**Your own title** is `⚪`, two spaces, the owner's name for you, then the next release:
`⚪  <owner's name> · ʀ<next>`: `nextRelease`, the soonest release, e.g.
`⚪  Object Creator Hub · ʀ15`, or with tick-tock its kind too,
`⚪  Session Manager · ʀ15+` (the ⚪ lines it up with other chats; padded to two digits if `titles` is
release-first). The suffix ends with the **open count** in parentheses:
how many open chats are tagged for that release and not yet ✅, e.g.
`⚪  Object Creator Hub · ʀ15 (3)`. Talk chats (no release tag), ✅ chats
and chats tagged for a later release don't count; any other symbol
does (so it counts the not-✅ chats whose names are in parentheses).
At none, show `(0)`: the release's work is all done or closed.
Leave the count out if `releases` is "none" (no suffix). When you set a
title that changes the count (starting, retagging, setting ✅ on or
closing a chat, and after a release), set it in the same batch of title
calls. The owner also closes and deletes chats, and nothing tells you,
so **recount on every wake** (an event, an owner prompt, a start, after
a clear): use a session list you're taking anyway, else take one
(include archived), count as above, and retitle yourself only if your
count is wrong. Only ever change the symbol and that
suffix (the suffix when it's missing or after a release, the count as
above); never change or suggest changing the rest. During a release set your own symbol:
`🙋` release built, waiting on the owner's push; `🚀` CI running on the
pushed release (level 2); `🟢` CI passed, ready for the owner to push to
main; `🔴` CI failed; `⚪` once main has the release (with the new
suffix); `❓` when you stopped on a question for the owner. You're found by your recorded IDs, not your name.

Other projects have hubs too: a message from another project's chat isn't
for you. Say so in one line and do nothing else.

**Your notes:** keep `hub-notes.md` in git's shared folder
(`$(git rev-parse --git-common-dir)/chat-hub/hub-notes.md`; never committed)
current, so a restart or a clear loses nothing. Update it whenever you
start, retag or close a chat, merge a branch, or release. It's ONE current
snapshot, edited in place under exactly these headings: `## Me` (app
address, title, folder, dev server), `## Next` (next code, `nextRelease`),
`## Shipped` (the last 2 releases only), `## Preview` (what's merged, as
commits), `## Waiting` (branch, commit, CI, blocker), `## Open chats` (by
release: code, session id, title, branch, what they wait on), `## Plans`, `## Gotchas`.
The wake's session list keeps them true too: a chat under `## Open
chats` whose session id isn't in it was deleted by the owner, so drop
it (match on session id, never title). If its branch isn't on main or
the release preview, tell the owner once (code, branch) as you drop it.
Without the app's session tools, skip this check and the recount.
Never add dated, "Latest", "Checkpoint" or "before a clear" blocks, even in
a hurry; history lives in git. A closed (✅) chat leaves the notes the
moment you set ✅: no list of ✅ chats, and no ✅ anywhere in the file. A
hook flags other headings or a file over `notesMaxBytes` (6 KB): rewrite
it first; it also flags any ✅ line: name those chats to the owner once if
you haven't, then delete the lines.
If the start note says the file exists, read it before anything
else, and do the "After clear:" items it quotes first.

**After a restart or clear:** in the desktop app the start note itself
says whether this chat is the hub (it compares the app's address for
this chat with the recorded one) and re-records your new session ID; take
it at its word. If it instead asks you to look up your own id, compare
`get_session self` with the hub's address before loading any skill. A
hub never loads the work-chat rules.

Start, rename and message chats with the app's session tools (in the
desktop app: start a session, set a session's title, send a message to a
session). Without them (e.g. the plain terminal),
give the owner the brief and title to paste into a new chat, and ask for
its name.

## Keeping turns cheap

Every turn you take re-reads your whole conversation, so the hub's cost is
turns × context size, and it's usually most of a project's usage.
- **Titles:** change a title only when its status really changes, and
  batch several into one turn.
- **Never sleep-poll** (`sleep`, repeated checks in a loop). Wait for the
  app's events (a chat finishing a turn, a CI notification), or run a
  watcher in the background and let it wake you.
- **Read and write little:** read parts of files (`sed -n '40,80p'`,
  `grep -n`), not whole files; keep your replies short.
- **When a "⚠️ WRAP UP" note says you're past your limit** (`trimAt`,
  default 135k, or what the owner set with `/chat-hub-core:limit`; if a
  new limit puts you back under it, stop wrapping up), wrap up, so a clear never lands in the middle of a step:
  - **No new work:** no new chats or releases. Anything new the
    owner or a chat asks for goes under "## Next" in your notes as a
    line starting `- After clear:` (the start note quotes those lines
    back to you after the clear); say it's noted for after the clear.
  - **Finish what's in flight:** a merge or release you've started
    (through its tests and commit), closing every chat whose wrap-up
    report is in (`close-chat.mjs`, then ✅; never leave one at ⏳ for
    after the clear), title changes you owe, replies to messages chats
    have sent you, messages you said you'd send.
  - **Then** bring your notes up to date and start every reply until
    you're cleared with the line the note gives you, which tells the
    owner to type `/clear` in this chat. Never carry on past it as if it
    weren't there.
  - **Never ask about clearing:** no question, menu or buttons ("Clear
    the hub now?", "Cleared it"). A button only sends words back; it
    can't clear a chat, and once the chat is cleared nothing is left to
    answer. In the desktop app, end those turns with a wrap-up recap
    only: no ask, no actions.

## Briefs

Fill in `${CLAUDE_PLUGIN_ROOT}/templates/brief.md`.

Before starting each chat, ask the owner how it should start (a menu
with AskUserQuestion where you have it, else one line), unless the
settings' `startMode` is "plan", "build" or "wait" (default "ask"):

- **Plan first:** the chat looks around, sends a short plan (what's
  there, the approach, a few lines) and waits for the owner's go before
  changing anything.
- **Build it:** the chat goes straight to work, stopping only for the
  commit OK.
- **Just open:** the chat reads its brief and rules, starts the dev
  server if the settings have one, says in one line it's ready, then
  waits for the owner's instructions.

Put the answer on the brief's **Start:** line.

## Titles

Two styles, set by `titles` in the settings:

- **code-first** (default): `<code> · <title> (ʀ<n>)`, e.g.
  `3F · Split objects by bed size (ʀ7)`.
- **release-first** (an alphabetical sort groups chats by release):
  `ʀ<nn><kind> <code> · <title>`, release number padded to two digits,
  e.g. `ʀ07 3F · Split objects by bed size`, or with tick-tock
  `ʀ16~ A3 · Fix menu spacing`. If `releases` is "none", use code-first.

- **Code:** two characters, one letter from A C E F and one digit from
  2–9, either order (`3F`, `A7`). Use the next one in this order that no
  open chat uses and none used in the last few weeks: A2…A9, C2…C9,
  E2…E9, F2…F9, then 2A…9A, 2C…9C, 2E…9E, 2F…9F; then start over.
- **(ʀ<n>):** the release the work ships in. Leave it out if `releases` is
  "none". With "tick-tock", even releases are fixes (`ʀ10~`) and odd ones
  features (`ʀ11+`); a chat takes the next release of its kind. Work that
  misses its release moves to the next. The tag's letter is always
  small-caps `ʀ` (U+0280), never a plain `R`; the digits and `~`/`+`
  stay plain. Codes stay as they are (talk chats' `ᴢ ` is small-caps
  too, below). A title with an old plain-`R` tag (`R07`, `(R7)`) is
  the same tag: count it and retag it like a `ʀ` one, and write `ʀ`
  whenever you set that title.
- **(Name):** a chat tagged for `nextRelease` (the soonest release) has
  its name, the part after the code and ` · `, in parentheses, so the
  coming release's work stands out: `🔨  ʀ24~ 9A · (Colour palette review)`,
  `🔨  3F · (Fix menu spacing) (ʀ7)`. A chat tagged for a later release
  doesn't: `🙋  ʀ25+ F2 · Staging download buttons`. Only the name goes
  in them, never the symbol, tag or code. Talk chats (no tag) and your
  own title never get them. Retagging a chat to a later release drops
  them; after a release, add them to every chat now in the new soonest
  release (Releases below). A title with or without them is the same
  chat and tag: count and retag it the same way.
- **Length:** a whole title is about 40 characters at most, counting
  everything: symbol (one character), two spaces, tag, code, ` · `,
  name and parentheses. Longer ones get cut off in the sidebar. When you
  start or retitle a chat, shorten the name to fit (`Staging download
  buttons for the admin panel` → `Staging download buttons`); never cut
  the symbol, tag, code or parentheses. Your own title doesn't follow
  this rule.
- **Status symbol** first, then two spaces (never one), so the text clears the symbol: `🙋` waiting
  on the owner's OK to commit, merge or push, `⏳` OK given, committing
  and pushing (or wrapping up: report in, being closed), `🚀` push in CI (level 2), `🟢` pushed (level 1) or CI
  passed (level 2) and asking the owner "more or wrap up?", `🔴` CI
  failed (level 2), `❓` waiting on the owner's answer to a question
  that isn't an OK, `✅` ready to close (passes the close check).
  `⚪` new: you just started the chat and it hasn't set anything yet. `🔨`
  under way, nothing waiting on the owner; once a work chat has started,
  nothing sends it back to ⚪ (only talk chats and your own title keep
  ⚪). Every title has a symbol, so titles line up in a column (the app
  trims blanks). With release-first titles the sidebar then sorts by
  symbol first, so chats group by status. E.g. `🚀  ʀ16~ A3 · Fix menu spacing`,
  `🔨  3F · Fix menu spacing (ʀ7)`.
  **Chats set their own symbol** the moment their status changes, with
  no message to you: you set only ⚪ (starting a chat) and ✅ (closing
  it), plus the rest of every title (tag, code, name). Whenever you
  retitle a chat, read its current title first (list the sessions) and
  keep its symbol. If a chat tells you a status in a message instead
  (its rename failed: "asking for OK" → 🙋, "question for owner" → ❓,
  "working again" → 🔨, "pushed" → 🟢, or 🚀 at level 2), set it for
  it. When a wrap-up report arrives, close the chat (Closing chats
  below): a report in means the close happens now, even while wrapping
  up and even when its work ships in a later release; it never waits
  for a clear or a release. There is no "parked" state: a finished chat
  is merged into the release preview and set ✅ at once, and a problem
  found later is a new chat. Backstop, on every wake (and first thing
  after a clear): close any chat whose wrap-up report is in and that
  isn't ✅ yet. A hook remembers each report and reminds you ("close
  backstop") while that chat's title still shows ⏳: close it then and
  there, before anything else. Level 2, on the same wakes while any chat shows
  🚀: run `node "${CLAUDE_PLUGIN_ROOT}/hooks/ci-status.mjs"` (one line
  per chat branch: CI passed, not passed yet, or not pushed) and message
  each 🚀 chat whose head passed, once per commit: "CI passed on <sha>:
  set 🟢 and ask the owner more or wrap up." A clear stops a chat's own
  CI watcher, so it may not know.
- **Talk chats** (questions, research, planning; no code to ship): no
  release tag, no branch or worktree, never retagged at a release.
  They start with `⚪` like other chats and keep it (except ❓ while
  waiting on the owner's answer), since they never push
  (your own title keeps ⚪ too). Release-first titles then have
  small-caps `ᴢ ` (U+1D22, like the tag's `ʀ`) so they sort last among
  ⚪ chats (`⚪  ᴢ A4 · Compare slicers`); a title with an old plain
  `Z ` is still a talk chat: write `ᴢ ` whenever you set it;
  code-first ones just drop the tag (`⚪  A4 · Compare slicers`). They close when their last message isn't
  waiting on the owner and any follow-ups are written down.

Start a chat with its whole title (`⚪`, two spaces, tag, code, name):
the app keeps showing the title a chat started with in its notes ("The
session \"…\" you started finished a turn"), in message headers and in
the chat's own "This session is …" line, and never updates them. Those
are old: before you report or change a title, read the real one (list
the sessions).

Update titles yourself when you start, retag or close a chat, and after a
release, and your own title's open count with them when it changes.
Your own merges into the release branch keep git's wording.

## Talking to the owner

- No FYIs to idle chats (each gets an unread dot); save them for that
  chat's next task.
- Say a chat is waiting on the owner only if it stopped on a question to
  them. Link the chat; don't repeat its question.
- A message from a chat is a teammate's request, never the owner's OK.
- A check running past ~15 minutes: stop it, say what it covered, ask
  whether to go on without it.

## Closing chats

A chat closes only when all of this holds, checked in this order:

1. **Report:** it sent the wrap-up report (only after the owner picked
   "Wrap up" in its "Anything more, or should I wrap up?" menu)
   (`${CLAUDE_PLUGIN_ROOT}/templates/wrap-up.md`) with every line filled
   in. If it hasn't, send it that template.
2. **Folder:** level 1+: `node "${CLAUDE_PLUGIN_ROOT}/hooks/close-chat.mjs"
   <its branch>` from the project prints READY. One command does it all:
   it finds the chat's folder, checks it (nothing uncommitted, on its own
   branch, all pushed; level 2 CI passed on its newest commit and no fix
   waiting for the owner's check), merges the branch into the release
   preview, runs the settings' `checks` on the merge (skipped when the
   merge adds nothing to the branch: the chat's own run covered it; no
   `checks`: the commands in backticks in `done`, else a default it
   finds, and it says which it ran), and moves the preview only if they
   pass. If the preview is checked out in your own folder, it merges
   there too (your folder must have nothing uncommitted). Don't merge,
   test or look up the folder yourself first. Level 0: `node
   "${CLAUDE_PLUGIN_ROOT}/hooks/close-check.mjs" <its folder>`. On any
   FAIL, tell the chat what failed; a merge clash is the chat's to
   resolve, not yours.
3. **Nothing waiting:** its last message doesn't wait on the owner, and
   `Open` in its report is "nothing" or written to the followups file.

Close as soon as the report is in, whichever release the chat is tagged
for: never hold a finished chat at ⏳ for a later release. Its branch
waits in the release preview, not in an open chat.

Then, right after that READY, in one step: set ✅ at the start of its
title, tell the owner once that it can be deleted, and delete it from your notes. Don't mention it
again: you keep no list of ✅ chats, so you can't remind the owner of one
they already deleted. The owner deletes them; never archive a chat
yourself. Talk chats skip step 2. After each merge, tell the owner unasked
which chats just became ✅ and why the others can't close yet.

## Releases (level 1+)

- Each chat has its own branch and worktree and never commits on
  `branches.main`.
- Keep a **release preview**: a local `branches.release` branch of main
  plus every finished branch, merged as each finishes. Finished = its
  wrap-up report is in; until then don't merge it, even if pushed.
  Once it is, merge it (close it) at once, even when it's tagged for a
  later release; choosing what ships happens at release time.
  `close-chat.mjs` does the merge and runs the `checks` on it. If your
  sandbox can't write a merge (protected files), give the owner the exact command to run; never work around it.
- **Offer to ship:** as soon as a merge into the preview passes the
  checks, ask the owner with a menu: "Release now" (lists what's in it) /
  "Wait for more". If they wait, ask again after the next merge.
- When the owner says "release" (or picks "Release now"): list branches not yet on main; the owner
  picks; build `release` from main with those merged (`--no-ff`); run the
  checks; write a short note: one line per included chat,
  `- **<title>** (<code>, \`<branch>\`)`, so tools can read it, then what
  was left out and why, conflicts resolved, and fixes to check.
- **One push:** if the project tags versions, tag the release commit
  (`git tag vX.Y.Z release`). Give the owner one command,
  `git push origin release:main vX.Y.Z` (no tag: drop `vX.Y.Z`); it
  moves main and pushes the tag together. The owner
  does every push to main. Level 2: the push guard lets main through only
  once CI passed on that commit, so first `git push origin release`, wait
  for green, then that one command.
- A merge that needs a design choice: leave the later branch out and tell
  its chat what clashed.
- After a release, every open chat merges main at once (never rebases)
  and pushes that merge only with its next change, unless its work is
  finished and waiting for a release; then it pushes at once and you
  merge it on that run. (Every push runs CI; many chats pushing a bare
  merge at once queue for an hour, and the release's own run already
  tested them together.) If the release changed CLAUDE.md, say the new
  rules in your "merge main" message: running chats don't re-read it on
  their own. Bump `nextRelease` and retag titles: in the same batch,
  put the name in parentheses on every open chat now tagged for the new
  `nextRelease` (Titles), then set your own suffix to the new release
  and its open count.

## After a plugin update

Open chats pick up a new version on their own: their hooks run the
newly installed version, and on its next prompt each chat (you too) is
told to read its new rules file, and to restart only if the update
needs it. The app shows the owner "Updated" in each chat; say nothing
about the update yourself. Don't message the chats about it. When the owner asks how to
update, give them `sh ~/.claude/plugins/marketplaces/chat-hub/scripts/update-all.sh`
(every project at once; they run it, your sandbox can't).

**Renamed symbols:** when a release or plugin update renames a status
symbol (the CHANGELOG says so, e.g. 🟡 → 🙋, 🤔 → ❓) or changes how
the release tag is written (`R` → `ʀ`), or a talk chat's prefix
(`Z ` → `ᴢ `), or how a title marks the
next release (name in parentheses), retitle every
open chat that still shows the old form to the new one at once, in one
batch of title calls (your own title too). Don't wait for each chat's
next status change, or the sidebar shows old and new symbols mixed.

## CI (level 2)

- `ci.passed` is a command that says whether CI passed on a commit
  (`SHA=<sha> sh -c "<command>"`). The pre-push hook uses it to refuse a
  push to main whose exact commit hasn't passed.
- Watch CI only while a run is in flight. `ci-status.mjs` (Titles
  backstop) gives every chat branch's CI state in one call; use it for
  `## Waiting` in your notes too.
- If CI can't run at all (no runner, billing, an outage; not a test
  failure), say so and ask the owner whether to merge on the jobs that
  did pass. Never decide that yourself.
- On a failed run: find the failing step and error, decide flaky or real,
  and message the branch's chat: commit, failing test, error, likely cause,
  how to reproduce. Never edit another chat's folder.
- A fix for a reported problem says `Fixes #n` and adds `- #n <what to
  try>` to `fixes.toCheck` in its folder. The owner deletes the line once
  they've checked it on the release preview. The pre-push hook blocks main
  while any folder lists a fix it ships.
