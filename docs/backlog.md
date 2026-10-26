# Backlog

Open work for chat-hub-core. Newest first within each section.

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
