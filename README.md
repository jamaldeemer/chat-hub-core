# chat-hub-core

A Claude Code plugin for running many Claude chats on one project. You talk
to one **hub** chat; it starts a chat for each task, keeps their titles
tidy, tells you when each can close, and (optionally) gathers their work
into releases that reach `main` only after CI passes.

## Install

You need Claude Code (terminal or the desktop app's Code tab), git and Node.

1. Add this marketplace (once per computer), in a terminal:

   ```
   claude plugin marketplace add jamaldeemer/chat-hub-core#v0.3.1
   ```

2. Turn the plugin on in your project:

   ```
   cd path/to/your-project
   claude plugin install chat-hub-core@chat-hub --scope project
   ```

3. Open a new chat in the project (terminal or desktop app; trust the
   folder if asked) and type `/chat-hub-core:setup`. It asks a few
   questions, shows what it will write, and writes it when you say yes.
4. Name one chat what setup says (`<project> Hub`) and talk to it.

Run setup again to change level or move to a newer version. Commit the files
it writes and anyone who clones the project gets the same setup (they only
repeat steps 1–2).

## Levels

| Level | Adds | Needs |
|---|---|---|
| 0 | Hub + one chat per task, codes in titles (`C34 · Title (R7)`), briefs, wrap-ups | nothing |
| 1 | Each chat on its own branch; releases gather finished branches | git |
| 2 | `main` only gets releases that passed CI and whose fixes you've checked | CI you can ask "did commit X pass?" |

## How it works

The rules are three skills: `setup`, `hub`, `work-chat`. A start-of-chat
hook tells each chat which to load. Your project gets a settings file,
`.claude/chat-hub.json` (level, release style, what "done" means, the CI
command), and a three-line note in CLAUDE.md. Nothing in the plugin names
a git host, CI service or framework.

## Working on the plugin

- Try unreleased changes: `claude --plugin-dir path/to/chat-hub-core`
- Checks: `sh tests/run.sh` and `claude plugin validate .`
- Release: bump `version` in `.claude-plugin/plugin.json`, add a
  `CHANGELOG.md` section, commit, `git tag vX.Y.Z`, push the branch and tag.
  Projects keep their pinned version until setup moves them.

## License

MIT
