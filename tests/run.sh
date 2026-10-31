#!/bin/sh
# chat-hub-core's own checks: the hooks' messages and the pre-push gate, in throwaway repos.
set -u
root=$(cd "$(dirname "$0")/.." && pwd); fail=0
t() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got [$2] want [$3]"; fail=1; fi; }
tmp=$(mktemp -d "${TMPDIR:-/tmp}/chat-hub-test.XXXXXX") && [ -d "$tmp" ] || { echo "no temp folder"; exit 1; }; cd "$tmp" || exit 1
t "no config: suggests setup" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'chat-hub-core:setup')" 1
mkdir .claude; echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "no hub: tells the owner" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'No hub is recorded.*tell the owner')" 1
t "no hub: never guesses by name" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'guess one by its name')" 1
echo '{"level":0,' > .claude/chat-hub.json
t "broken settings: reported loudly" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'settings file .* is broken')" 1
echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
echo '{"level":0,"hubSession":"s1"}' > .claude/chat-hub.json
t "hub session: this chat is the hub" "$(echo '{"session_id":"s1"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
t "hub session: others message only it" "$(echo '{"session_id":"s2"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message that session')" 1
echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
t "commit reminder: done" "$(echo '{"tool_input":{"command":"git commit -m \\"3F: x\\""}}' | node "$root/hooks/before-commit.mjs" | grep -c 'tests pass')" 1
t "commit reminder: quiet on other commands" "$(echo '{"tool_input":{"command":"ls -la"}}' | node "$root/hooks/before-commit.mjs" | wc -c | tr -d ' ')" 0
t "commit reminder: quiet on git status" "$(echo '{"tool_input":{"command":"git status"}}' | node "$root/hooks/before-commit.mjs" | wc -c | tr -d ' ')" 0
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
t "prompt hook: /hub refuses to take over" "$(echo '{"session_id":"s3","prompt":"/chat-hub-core:hub"}' | node "$root/hooks/on-prompt.mjs" | grep -c 'NOT recorded as the hub: s1')" 1
t "prompt hook: /hub replace takes over" "$(echo '{"session_id":"s3","prompt":"/chat-hub-core:hub replace"}' | node "$root/hooks/on-prompt.mjs" | grep -c 'replaced s1')" 1
t "set-hub: refuses to take over" "$(node "$root/hooks/set-hub.mjs" --session s4 2>&1 | grep -c 'add --replace')" 1
t "prompt hook: ignores other prompts" "$(echo '{"session_id":"s4","prompt":"hello"}' | node "$root/hooks/on-prompt.mjs" | wc -c | tr -d ' ')" 0
node "$root/hooks/set-hub.mjs" --session s5 --app local_A --replace >/dev/null
t "two IDs: hub by session ID" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
t "two IDs: others message the app address" "$(echo '{"session_id":"s6"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message local_A')" 1
t "two IDs: same app address may re-record (restart)" "$(node "$root/hooks/set-hub.mjs" --session s5b --app local_A 2>&1 | grep -c 'Hub is now local_A')" 1
node "$root/hooks/set-hub.mjs" --session s5 --app local_A >/dev/null
t "two IDs: restarted hub can recognise itself" "$(echo '{"session_id":"s7"}' | node "$root/hooks/session-start.mjs" | grep -c 'if its id is local_A, this chat is the hub')" 1
node "$root/hooks/set-hub.mjs" --session s8 --replace >/dev/null
t "two IDs: hub without app address is told to add it" "$(echo '{"session_id":"s8"}' | node "$root/hooks/session-start.mjs" | grep -c -- '--app')" 1
node "$root/hooks/set-hub.mjs" --app local_B >/dev/null
t "two IDs: --app alone keeps the session" "$(echo '{"session_id":"s8"}' | node "$root/hooks/session-start.mjs" | grep -c 'This chat is the hub')" 1
node "$root/hooks/set-hub.mjs" --session s5 --app local_A --replace >/dev/null
echo '# notes' > .git/chat-hub/hub-notes.md
t "hub notes: hub told to read them" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'read .*hub-notes.md before anything else')" 1
t "hub notes: others only if they turn out to be the hub" "$(echo '{"session_id":"s6"}' | node "$root/hooks/session-start.mjs" | grep -c 'if its id is local_A, this chat is the hub.*hub-notes.md.*Otherwise this is a work chat')" 1
rm .git/chat-hub/hub-notes.md
printf 'local_C\n' > .git/chat-hub/hub
t "older file with an app address still works" "$(echo '{"session_id":"s9"}' | node "$root/hooks/session-start.mjs" | grep -c 'only ever message local_C')" 1
git worktree remove --force ../wt2; rm -rf .git/chat-hub
# guard.mjs: hard stops (level 1)
echo '{"level":1}' > .claude/chat-hub.json; here=$(pwd)
g() { printf '%s' "$1" | node "$root/hooks/guard.mjs" | grep -c '"deny"'; }
bash_in() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "$1" "$here" "$2"; }
hd=$(printf 'git commit -m "$(cat <<%sEOM%s\nA7: Fix it\n\nbody\nEOM\n)"' "'" "'")
t "guard: commit on main refused" "$(g "$(bash_in w1 'git commit -m "3F: x"')")" 1
t "guard: rebase refused" "$(g "$(bash_in w1 'git rebase main')")" 1
t "guard: pull --rebase refused" "$(g "$(bash_in w1 'git pull --rebase origin main')")" 1
git checkout -q -b feat
t "guard: commit on own branch allowed" "$(g "$(bash_in w1 'git commit -m "3F: x"')")" 0
t "guard: commit without code refused" "$(g "$(bash_in w1 'git commit -m "Fix it"')")" 1
t "guard: heredoc message with code allowed" "$(g "$(bash_in w1 "$hd")")" 0
t "guard: old-style code allowed" "$(g "$(bash_in w1 'git commit -m "L76: x"')")" 0
node "$root/hooks/set-hub.mjs" --session hubS >/dev/null
git checkout -q main
t "guard: hub may commit on main" "$(g "$(bash_in hubS 'git commit -m "Release note: R2+"')")" 0
git checkout -q feat
git worktree add -q ../wt3 -b other 2>/dev/null
edit_in() { node -e 'process.stdout.write(JSON.stringify({session_id:"w1",cwd:process.argv[1],tool_name:"Edit",tool_input:{file_path:process.argv[2]}}))' "$here" "$1"; }
t "guard: edit in own worktree allowed" "$(g "$(edit_in "$here/a.txt")")" 0
t "guard: edit in another worktree refused" "$(g "$(edit_in "$(cd ../wt3 && pwd)/a.txt")")" 1
t "guard: edit outside the repo allowed" "$(g "$(edit_in /tmp/elsewhere.txt)")" 0
git worktree remove --force ../wt3; git branch -q -D other; git checkout -q main; git branch -q -D feat; rm -rf .git/chat-hub
# usage.mjs: the stats line and the trim nudge (state kept under a throwaway TMPDIR)
oldtmp="${TMPDIR:-}"; export TMPDIR="$tmp/state"; mkdir -p "$TMPDIR"
tr="$tmp/transcript.jsonl"
asst() { printf '{"type":"assistant","message":{"id":"%s","usage":{"input_tokens":%s,"cache_read_input_tokens":%s,"cache_creation_input_tokens":0,"output_tokens":5}}}\n' "$1" "$2" "$3" >> "$tr"; }
asst m1 10 1000; asst m1 10 1000; asst m2 20 3000
printf '{"type":"assistant","isSidechain":true,"message":{"id":"sub","usage":{"input_tokens":1,"cache_read_input_tokens":999999}}}\n' >> "$tr"
at() { printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s"}' "$1" "$tr" "$(pwd)" | node "$root/hooks/after-turn.mjs"; }
t "stats: context, turns, reads" "$(at u1)" '{"systemMessage":"Context 3k · 2 turns · this chat ≈ 4k token-reads"}'
asst m3 0 200000
t "stats: reads only what's new" "$(at u1 | grep -c 'Context 200k · 3 turns')" 1
echo '{"level":0,"stats":false}' > .claude/chat-hub.json
t "stats: off when stats is false" "$(at u1 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
node "$root/hooks/set-hub.mjs" --session u1 --replace >/dev/null
op() { printf '{"session_id":"%s","prompt":"hi","cwd":"%s"}' "$1" "$(pwd)" | node "$root/hooks/on-prompt.mjs"; }
t "trim: hub past trimAt is nudged" "$(op u1 | grep -c 'hub notes up to date')" 1
t "trim: not again under the next step" "$(op u1 | wc -c | tr -d ' ')" 0
asst m4 0 226000; at u1 >/dev/null
t "trim: again 25k over, says how far" "$(op u1 | grep -c '226k tokens (limit 150k, 76k over)')" 1
t "trim: once per step" "$(op u1 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000,"trimEvery":10000}' > .claude/chat-hub.json
asst m5 0 237000; at u1 >/dev/null
t "trim: trimEvery sets the step" "$(op u1 | grep -c '87k over')" 1
asst m6 0 50000; at u1 >/dev/null; op u1 >/dev/null
asst m7 0 151000; at u1 >/dev/null
t "trim: resets after a clear" "$(op u1 | grep -c 'hub notes up to date')" 1
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
at u2 >/dev/null
t "trim: work chats not by default" "$(op u2 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000,"trimAtWork":100000}' > .claude/chat-hub.json
t "trim: work chats with trimAtWork" "$(op u2 | grep -c 'natural stopping point')" 1
rm -rf .git/chat-hub; export TMPDIR="$oldtmp"
echo '{"level":0,"done":["tests pass"]}' > .claude/chat-hub.json
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
# close-check.mjs: is a chat's folder safe to close?
cc() { node "$root/hooks/close-check.mjs" "$1" >/dev/null 2>&1; echo $?; }
ccw() { node "$root/hooks/close-check.mjs" "$1" 2>&1 | grep -c "$2"; }
mkdir "$tmp/cc" && cd "$tmp/cc" && git init -q --bare remote.git && git init -q -b main repo && cd repo
gc() { git -c user.email=a@b -c user.name=t commit -q "$@"; }
mkdir .claude && echo '{"level":1}' > .claude/chat-hub.json && git add -A && gc -m init && git remote add origin ../remote.git && git push -q origin main
git branch release; git worktree add -q ../wt -b a2-work; wt="$tmp/cc/wt"
t "close-check: level 0 still checks uncommitted" "$(echo '{"level":0}' > "$wt/.claude/chat-hub.json"; ccw "$wt" 'FAIL uncommitted')" 1
git -C "$wt" checkout -q -- .claude/chat-hub.json
echo x > "$wt/f.txt"
t "close-check: uncommitted fails" "$(ccw "$wt" 'FAIL uncommitted')" 1
git -C "$wt" add -A; git -C "$wt" -c user.email=a@b -c user.name=t commit -q -m "A2: x"
t "close-check: never pushed fails" "$(ccw "$wt" 'FAIL pushed: the branch has never been pushed')" 1
git -C "$wt" push -q origin HEAD
t "close-check: no upstream, remote branch matches passes" "$(ccw "$wt" 'PASS pushed: all of it, to origin/a2-work')" 1
echo y > "$wt/g.txt"; git -C "$wt" add -A; git -C "$wt" -c user.email=a@b -c user.name=t commit -q -m "A2: y"
t "close-check: no upstream, remote branch behind fails" "$(ccw "$wt" 'FAIL pushed: 1 commit(s) not pushed to origin/a2-work')" 1
git -C "$wt" push -q origin HEAD
t "close-check: not in the preview fails" "$(ccw "$wt" "FAIL merged")" 1
git checkout -q release; git -c user.email=a@b -c user.name=t merge -q --no-ff a2-work -m "Merge a2"; git checkout -q main
t "close-check: level 1 all good is ready" "$(cc "$wt")" 0
t "close-check: with an upstream set still passes" "$(git -C "$wt" branch -q -u origin/a2-work; ccw "$wt" 'PASS pushed: all of it, to origin/a2-work')" 1
echo '{"level":2,"ci":{"passed":"echo 0"}}' > "$wt/.claude/chat-hub.json"
t "close-check: level 2 CI not passed fails" "$(ccw "$wt" "FAIL CI: hasn't passed")" 1
echo '{"level":2,"ci":{"passed":"echo 1"}}' > "$wt/.claude/chat-hub.json"
echo '- #9 try it' > "$wt/.claude/issues-to-check.md"
t "close-check: unchecked fix fails" "$(ccw "$wt" 'FAIL fixes: 1 still waiting')" 1
cd "$tmp"
rm -rf "$tmp"; exit $fail
