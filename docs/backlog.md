# Backlog

Open work for chat-hub-core. Newest first within each section.

## Next

- **The hub's recorded ID can't be messaged.** The hook records Claude
  Code's session ID, but the desktop app's messaging uses its own session
  addresses (`local_…`), so a work chat can't send to the ID in its brief
  and falls back to guessing among linked chats (seen in the sandbox,
  2026-10-25). Fix: when the hub records itself, also save its app address
  (from the app's session tools, "self"); briefs and start notes give that
  for messaging and keep the session ID for matching.
- **Less confusing marketplace name.** The marketplace is `chat-hub` and
  the plugin `chat-hub-core`, so commands mix both
  (`marketplace update chat-hub`, `plugin update chat-hub-core@chat-hub`)
  and it's easy to type the wrong one. Pick names that read clearly
  (e.g. marketplace `jamaldeemer` or `chat-hub-plugins`), keeping room for
  a later `chat-hub-local`. Renaming means every project removes and
  re-adds the marketplace once, so do it together with another release.
- Trim the brief: it repeats "load the work-chat skill", which the start
  hook already does.

## From moving object_creator onto the plugin (2026-10-25)

Findings 1–3 shipped in 0.3.4. Still open:

- **Wrapping an existing pre-push** (setup): "add a line to theirs that
  runs it" is unsafe, since git passes the pushed refs on stdin and only one
  reader gets them. Show the pattern:
  `input=$(cat); printf '%s\n' "$input" | sh "$(dirname "$0")/chat-hub-pre-push" || exit 1`.
- **Setup's suggested `ci.passed`:** `gh run list --commit` needs a recent
  gh and can't reach GitHub from a sandboxed chat. Suggest a REST query on
  `head_sha` + `status=success` (object_creator's `scripts/ci-passed.sh`).
- **Where pre-push reads settings:** with an absolute `core.hooksPath` to
  the main folder, the hook comes from main but the settings from the
  pushing worktree. One line in the README.
- **Tick-tock and `nextRelease`:** fixes and features chats take different
  next releases (R14~ vs R15+). The hub skill should say how to work out
  each kind's number from the one setting.
- **Moving from a project's own chat codes:** say that open chats keep their
  old codes until they close (2-character codes can't clash with longer
  ones).
- **Commit reminders stack:** a project with its own commit hook gets two
  notes. Setup could offer to move its text into `commitReminder`.
- **Version drift:** unpinned projects silently run whatever version the
  owner's marketplace points at. The start note could say which version is
  running.

## Earlier ideas

- Setup offers to pre-approve the hub's session tools (start, rename,
  message), so the owner sees fewer permission prompts.
- Level 1 blocks direct pushes to main, not only level 2.
- An `overrides` setting so projects can change a core rule without a fork.
- Rebuilding `docs/all-prompts.md`: put its script in the repo.
- Hooks in plain sh instead of Node (undecided).
- A `/review` helper: publish files as a commentable page, then apply the
  comments (could live in a chat-hub-local layer).
- A `/chat-hub-core:feedback` command to send plugin changes from any
  project to the plugin's own chat.
