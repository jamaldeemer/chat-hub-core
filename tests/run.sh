#!/bin/sh
# chat-hub-core's own checks: the hooks' messages and the pre-push gate, in throwaway repos.
set -u
root=$(cd "$(dirname "$0")/.." && pwd); fail=0
t() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got [$2] want [$3]"; fail=1; fi; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/chat-hub-test.XXXXXX") && [ -d "$tmp" ] || { echo "no temp folder"; exit 1; }; cd "$tmp" || exit 1
t "no config: suggests setup" "$(node "$root/hooks/session-start.mjs" | grep -c 'chat-hub-core:setup')" 1
mkdir .claude; echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "config: names hub" "$(node "$root/hooks/session-start.mjs" | grep -c 'or ends with .*Hub')" 1
echo '{"level":0,"hub":"cns Hub"}' > .claude/chat-hub.json
t "hub name: exact match" "$(node "$root/hooks/session-start.mjs" | grep -c 'is exactly \\"cns Hub\\"')" 1
t "hub name: only message this one" "$(node "$root/hooks/session-start.mjs" | grep -c 'only ever message this one')" 1
echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "commit reminder: done" "$(node "$root/hooks/before-commit.mjs" | grep -c 'tests pass')" 1
git init -q -b main &&  git -c user.email=a@b -c user.name=t commit -q --allow-empty -m one
mkdir .githooks && touch .githooks/pre-push; echo '{"level":1}' > .claude/chat-hub.json
t "level 1: guard off is flagged" "$(node "$root/hooks/session-start.mjs" | grep -c 'push guard')" 1
git config core.hooksPath .githooks
t "level 1: guard on is quiet" "$(node "$root/hooks/session-start.mjs" | grep -c 'push guard')" 0
git config --unset core.hooksPath
sha=$(git rev-parse HEAD); z=0000000000000000000000000000000000000000
push() { echo "refs/heads/x $sha refs/heads/$1 $z" | sh "$root/githooks/pre-push" >/dev/null 2>&1; echo $?; }
t "level 0: main not gated" "$(push main)" 0
echo '{"level":2,"ci":{"passed":"echo 0"}}' > .claude/chat-hub.json
t "level 2: CI not passed blocks main" "$(push main)" 1
t "level 2: other branch never blocked" "$(push feature)" 0
echo '{"level":2,"ci":{"passed":"echo 1"}}' > .claude/chat-hub.json
t "level 2: CI passed lets main through" "$(push main)" 0
git -c user.email=a@b -c user.name=t commit -q --allow-empty -m "Fixes #7"; sha=$(git rev-parse HEAD)
echo "- #7 try it" > .claude/issues-to-check.md
t "level 2: unchecked fix blocks main" "$(push main)" 1
rm .claude/issues-to-check.md
t "level 2: checked fix passes" "$(push main)" 0
rm -rf "$tmp"; exit $fail
