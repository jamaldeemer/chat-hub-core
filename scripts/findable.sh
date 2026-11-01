#!/bin/sh
# Switch whether strangers can find this repo in GitHub search: "on" sets the repo's
# description and topics, "off" clears them, "status" shows what's set now.
# Needs the GitHub CLI (gh), signed in as the repo's owner.
# Usage: sh scripts/findable.sh on|off|status [--dry-run]   (--dry-run prints the gh command)
set -u
repo=jamaldeemer/chat-hub-core
description="Claude Code plugin: run many Claude Code chats in parallel from one hub chat. Each task gets its own chat, git branch and worktree, with status in the sidebar and releases you approve."
topics=claude-code,claude-code-plugin,claude,claude-ai,anthropic,ai-agents,multi-agent,agent-orchestration,parallel-agents,git-worktree,ai-coding,ai-coding-assistant,developer-tools

dry=; [ "${2:-}" = "--dry-run" ] && dry=1
run() { if [ -n "$dry" ]; then printf "%s\n" "$*"; else "$@"; fi; }
case "${1:-}" in
  on)     run gh repo edit "$repo" --description "$description" --add-topic "$topics" ;;
  off)    run gh repo edit "$repo" --description "" --remove-topic "$topics" ;;
  status) run gh repo view "$repo" --json description,repositoryTopics ;;
  *) echo "Usage: sh scripts/findable.sh on|off|status [--dry-run]" >&2; exit 2 ;;
esac
