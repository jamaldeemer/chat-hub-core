#!/bin/sh
# chat-hub-core's own checks: the hooks' messages and the pre-push gate, in throwaway repos.
set -u
root=$(cd "$(dirname "$0")/.." && pwd); fail=0
t() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got [$2] want [$3]"; fail=1; fi; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/chat-hub-test.XXXXXX") && [ -d "$tmp" ] || { echo "no temp folder"; exit 1; }; cd "$tmp" || exit 1
t "no config: suggests setup" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'chat-hub-core:setup')" 1
mkdir .claude; echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "no hub yet: check the folder, ask if unsure" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'Check a candidate.s folder.*ask the owner')" 1
t "no hub yet: names Hub/Manager" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'ends with .*Hub.* or .*Manager')" 1
echo '{"level":0,"hubSession":"s1"}' > .claude/chat-hub.json
t "hub session: this chat is the hub" "$(echo '{"session_id":"s1"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
t "hub session: others message only it" "$(echo '{"session_id":"s2"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message that session')" 1
echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "commit reminder: done" "$(node "$root/hooks/before-commit.mjs" | grep -c 'tests pass')" 1
git init -q -b main &&  git -c user.email=a@b -c user.name=t commit -q --allow-empty -m one
echo '{"level":0}' > .claude/chat-hub.json
t "shared hub: written" "$(node "$root/hooks/set-hub.mjs" s1)" "Hub is now s1."
t "shared hub: this chat is the hub" "$(echo '{"session_id":"s1"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
t "shared hub: others message only it" "$(echo '{"session_id":"s2"}' | node "$root/hooks/session-start.mjs" | grep -c 'hub is session s1')" 1
t "start note: own session ID" "$(echo '{"session_id":"s2"}' | node "$root/hooks/session-start.mjs" | grep -c "session ID is s2")" 1
echo '{"level":0,"hubSession":"s9"}' > .claude/chat-hub.json
t "shared hub wins over settings" "$(echo '{"session_id":"s1"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
git -c user.email=a@b -c user.name=t worktree add -q ../wt2 2>/dev/null; mkdir -p ../wt2/.claude; echo '{"level":0}' > ../wt2/.claude/chat-hub.json
t "shared hub: seen from another worktree" "$(cd ../wt2 && echo '{"session_id":"s2"}' | node "$root/hooks/session-start.mjs" | grep -c 'hub is session s1')" 1
t "prompt hook: /hub records the chat" "$(echo '{"session_id":"s3","prompt":"/chat-hub-core:hub"}' | node "$root/hooks/on-prompt.mjs" | grep -c 'replaced s1')" 1
t "prompt hook: ignores other prompts" "$(echo '{"session_id":"s4","prompt":"hello"}' | node "$root/hooks/on-prompt.mjs" | wc -c | tr -d ' ')" 0
node "$root/hooks/set-hub.mjs" --session s5 --app local_A >/dev/null
t "two IDs: hub by session ID" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
t "two IDs: others message the app address" "$(echo '{"session_id":"s6"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message local_A')" 1
t "two IDs: restarted hub can recognise itself" "$(echo '{"session_id":"s7"}' | node "$root/hooks/session-start.mjs" | grep -c 'if its id is local_A, this chat is the hub')" 1
node "$root/hooks/set-hub.mjs" --session s8 >/dev/null
t "two IDs: hub without app address is told to add it" "$(echo '{"session_id":"s8"}' | node "$root/hooks/session-start.mjs" | grep -c -- '--app')" 1
node "$root/hooks/set-hub.mjs" --app local_B >/dev/null
t "two IDs: --app alone keeps the session" "$(echo '{"session_id":"s8"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
printf 'local_C\n' > .git/chat-hub/hub
t "older file with an app address still works" "$(echo '{"session_id":"s9"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message local_C')" 1
git worktree remove --force ../wt2; rm -rf .git/chat-hub
mkdir .githooks && touch .githooks/pre-push; echo '{"level":1}' > .claude/chat-hub.json
t "level 1: guard switched on" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'switched on')" 1
t "level 1: hooksPath set" "$(git config core.hooksPath)" ".githooks"
t "level 1: guard on is quiet" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'push guard')" 0
git config --unset core.hooksPath
sha=$(git rev-parse HEAD); z=0000000000000000000000000000000000000000
push() { echo "refs/heads/x $sha refs/heads/$1 $z" | sh "$root/githooks/pre-push" >/dev/null 2>&1; echo $?; }
t "level 0: main not gated" "$(push main)" 0
echo '{"level":2,"ci":{"passed":"echo 0"}}' > .claude/chat-hub.json
t "level 2: CI not passed blocks main" "$(push main)" 1
t "level 2: other branch never blocked" "$(push feature)" 0
t "level 2: says CI hasn't passed" "$(echo "refs/heads/x $sha refs/heads/main $z" | sh "$root/githooks/pre-push" 2>&1 | grep -c "hasn't passed")" 1
echo '{"level":2,"ci":{"passed":"exit 1"}}' > .claude/chat-hub.json
t "level 2: failing lookup says couldn't ask" "$(echo "refs/heads/x $sha refs/heads/main $z" | sh "$root/githooks/pre-push" 2>&1 | grep -c "couldn't ask CI")" 1
echo '{"level":2,"ci":{"passed":"true"}}' > .claude/chat-hub.json
t "level 2: no answer says couldn't ask" "$(echo "refs/heads/x $sha refs/heads/main $z" | sh "$root/githooks/pre-push" 2>&1 | grep -c "couldn't ask CI")" 1
echo '{"level":2,"ci":{"passed":"echo 1"}}' > .claude/chat-hub.json
t "level 2: CI passed lets main through" "$(push main)" 0
git -c user.email=a@b -c user.name=t commit -q --allow-empty -m "Fixes #7"; sha=$(git rev-parse HEAD)
echo "- #7 try it" > .claude/issues-to-check.md
t "level 2: unchecked fix blocks main" "$(push main)" 1
rm .claude/issues-to-check.md
t "level 2: checked fix passes" "$(push main)" 0
rm -rf "$tmp"; exit $fail
