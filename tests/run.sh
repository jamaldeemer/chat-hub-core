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
printf '# Hub notes\n## Me\nx\n## Next\nC5\n## Open chats (by release)\n- C4\n' > .git/chat-hub/hub-notes.md
t "notes check: clean small file quiet at start" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'ONE current snapshot')" 0
nc() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.cwd(),tool_name:"Write",tool_input:{file_path:process.argv[2]}}))' "$1" "$(pwd)/.git/chat-hub/hub-notes.md" > "$tmp/nc.json"; node "$root/hooks/notes-check.mjs" < "$tmp/nc.json" | grep -c 'ONE current snapshot'; }
t "notes check: clean small file quiet after a write" "$(nc s5)" 0
printf '## Latest 2026-10-31 ~06:30, BEFORE A CLEAR (read FIRST)\nx\n## Me\nx\n' > .git/chat-hub/hub-notes.md
t "notes check: diary headings flagged at start" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'headings outside the fixed sections.*ONE current snapshot')" 1
t "notes check: diary headings flagged after a write" "$(nc s5)" 1
t "notes check: work chats not told" "$(nc s6)" 0
printf '## CLEAR CHECKPOINT\nx\n' > .git/chat-hub/hub-notes.md
t "notes check: checkpoint heading flagged" "$(nc s5)" 1
{ echo '## Me'; i=0; while [ $i -lt 200 ]; do echo 'a line of notes that keeps going on'; i=$((i+1)); done; } > .git/chat-hub/hub-notes.md
t "notes check: oversize flagged" "$(nc s5)" 1
t "notes check: oversize says the limit" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'over the 6000-byte limit')" 1
echo '{"level":0,"notesMaxBytes":0}' > .claude/chat-hub.json
t "notes check: notesMaxBytes 0 turns size off" "$(nc s5)" 0
printf '## Me\nx\n## Open chats\n- ✅ R10 C8 · Newest version\n- C9 · Stop reminders\n' > .git/chat-hub/hub-notes.md
nd() { node "$root/hooks/notes-check.mjs" < "$tmp/nc.json" | grep -c "$1"; }
nc s5 >/dev/null
t "notes check: ✅ chat flagged after a write" "$(nd 'still list ✅ (closed) chats: \\"✅ R10 C8')" 1
t "notes check: ✅ chat, told once then deleted" "$(nd 'name them once.*delete those lines')" 1
t "notes check: ✅ alone is not a rewrite" "$(nd 'ONE current snapshot')" 0
t "notes check: ✅ chat flagged at start" "$(echo '{"session_id":"s5"}' | node "$root/hooks/session-start.mjs" | grep -c 'still list ✅')" 1
nc s6 >/dev/null
t "notes check: ✅ work chats not told" "$(nd 'still list ✅')" 0
printf '## Me\nx\n## Open chats\n- C9 · Stop reminders\n' > .git/chat-hub/hub-notes.md; nc s5 >/dev/null
t "notes check: no ✅ quiet" "$(nd 'still list ✅')" 0
echo '{"level":0}' > .claude/chat-hub.json
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
# guard.mjs: the commit OK must come from a menu (AskUserQuestion), read from the transcript
okt="$tmp/ok.jsonl"; : > "$okt"
ask() { printf '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"%s","name":"AskUserQuestion","input":{}}]}}\n{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"%s","content":"answered"}]},"toolUseResult":{"answers":{"%s":"%s"}}}\n' "$1" "$1" "$2" "$3" >> "$okt"; }
ran() { printf '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"%s","name":"Bash","input":{"command":"%s"}}]}}\n{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"%s","is_error":%s,"content":"x"}]}}\n' "$1" "$2" "$1" "$3" >> "$okt"; }
okin=$(node -e 'process.stdout.write(JSON.stringify({session_id:"w1",cwd:process.argv[1],transcript_path:process.argv[2],tool_name:"Bash",tool_input:{command:"git commit -m \"3F: x\""}}))' "$here" "$okt")
gk() { printf '%s' "$okin" | node "$root/hooks/guard.mjs" | grep -c "$1"; }
t "ok menu: no answer refused" "$(gk '"deny"')" 1
t "ok menu: says to use a menu" "$(gk 'AskUserQuestion tool')" 1
printf '{"type":"user","message":{"content":[{"type":"text","text":"yes, commit"}]}}\n' >> "$okt"
t "ok menu: typed yes refused" "$(gk '"deny"')" 1
ask a1 "Add tests too?" "Yes"
t "ok menu: yes to another question refused" "$(gk '"deny"')" 1
ask a2 "Commit this?" "Yes, commit"
t "ok menu: menu yes allowed" "$(gk '"deny"')" 0
ran g1 "grep 'git commit' notes.md" false
t "ok menu: a command that only mentions commit keeps it" "$(gk '"deny"')" 0
ran c1 "git add -A && git commit -q" true
t "ok menu: failed commit keeps it" "$(gk '"deny"')" 0
ran c2 "git add -A && git commit -q" false
t "ok menu: used up by a commit" "$(gk '"deny"')" 1
ask a3 "Ready to go?" "Yes, commit and push"
t "ok menu: commit in the answer counts" "$(gk '"deny"')" 0
ask a4 "Commit this?" "Not yet"
t "ok menu: later no takes it back" "$(gk '"deny"')" 1
printf '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"o1","name":"AskUserQuestion","input":{}}]}}\n{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"o1","content":"The user answered: \\"Commit it?\\"=\\"Yes\\". Go on."}]}}\n' >> "$okt"
t "ok menu: answer read from the text too" "$(gk '"deny"')" 0
ran c3 "git commit -q" false
git rev-parse HEAD > .git/MERGE_HEAD
t "ok menu: finishing a merge allowed" "$(gk '"deny"')" 0
rm .git/MERGE_HEAD
echo '{"level":1,"okMenu":false}' > .claude/chat-hub.json
t "ok menu: okMenu false turns it off" "$(gk '"deny"')" 0
echo '{"level":1}' > .claude/chat-hub.json
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
t "stats: context, turns, reads" "$(at u1)" "{\"systemMessage\":\"chat-hub-core $(node -p 'require(process.argv[1]).version' "$root/.claude-plugin/plugin.json") · Context 3k · 2 turns · this chat ≈ 4k token-reads\"}"
asst m3 0 200000
t "stats: reads only what's new" "$(at u1 | grep -c 'Context 200k · 3 turns')" 1
echo '{"level":0,"stats":false}' > .claude/chat-hub.json
t "stats: off when stats is false" "$(at u1 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
node "$root/hooks/set-hub.mjs" --session u1 --replace >/dev/null
op() { printf '{"session_id":"%s","prompt":"hi","cwd":"%s"}' "$1" "$(pwd)" | node "$root/hooks/on-prompt.mjs"; }
pt() { j=$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:process.argv[3],tool_input:JSON.parse(process.argv[4])}))' "$1" "$(pwd)" "$2" "$3"); printf "%s" "$j" | node "$root/hooks/guard.mjs"; }
# trim: one level at trimAt; the hub wraps up (no new work, finish what's in flight, notes, then ask to be cleared)
t "wrap up: hub past trimAt" "$(op u1 | grep -c 'WRAP UP.*past its limit of 150k.*no new work.*## Next.*in flight.*wrapping up.*notes saved. Type /clear in this chat.*Never ask the owner about clearing.*no ask or actions')" 1
t "wrap up: on every prompt" "$(op u1 | grep -c 'WRAP UP')" 1
asst m4 0 226000; at u1 >/dev/null
t "wrap up: no other levels further on" "$(op u1 | grep -c 'LAST WARNING\|HARD STOP')" 0
t "wrap up: tools never refused" "$(pt u1 mcp__x__send_message '{}' | grep -c '"deny"')" 0
t "wrap up: Bash never refused" "$(pt u1 Bash '{"command":"npm test"}' | grep -c '"deny"')" 0
asst m6 0 50000; at u1 >/dev/null; op u1 >/dev/null
t "wrap up: quiet after a clear" "$(op u1 | wc -c | tr -d ' ')" 0
asst m7 0 151000; at u1 >/dev/null
t "wrap up: once on a tool call when crossed" "$(pt u1 Read '{"file_path":"x"}' | grep -c 'WRAP UP')" 1
t "wrap up: not again on tool calls" "$(pt u1 Read '{"file_path":"x"}' | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":200000}' > .claude/chat-hub.json
t "wrap up: trimAt sets the limit" "$(op u1 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
asst m13 0 151000; at u2 >/dev/null
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
# close-chat.mjs: the hub's one-step close (merge into the preview, checks, close check)
mkdir "$tmp/ch" && cd "$tmp/ch" && git init -q --bare remote.git && git init -q -b main repo && cd repo
mkdir .claude && echo '{"level":1,"checks":"test ! -e bad.txt"}' > .claude/chat-hub.json && git add -A && gc -m init && git remote add origin ../remote.git && git push -q origin main
git branch release
ch() { GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=a@b GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=a@b node "$root/hooks/close-chat.mjs" "$1" 2>&1; }
chw() { ch "$1" | grep -c "$2"; }
wk() { git worktree add -q "../$1" -b "$1" main; echo "$3" > "../$1/$2"; git -C "../$1" add -A; git -C "../$1" -c user.email=a@b -c user.name=t commit -q -m "$1"; git -C "../$1" push -q origin HEAD; }
wk b1 f.txt one
echo dirt > ../b1/dirt.txt
t "close-chat: uncommitted stops before merging" "$(chw b1 'FAIL uncommitted')" 1
t "close-chat: preview left alone on a failed check" "$(git rev-parse release)" "$(git rev-parse main)"
rm ../b1/dirt.txt
t "close-chat: finds the folder itself" "$(chw b1 "PASS folder: .*/b1")" 1
t "close-chat: merge that adds nothing skips the checks" "$(git branch -f release main; chw b1 'PASS checks: skipped')" 1
t "close-chat: branch is in the preview" "$(git merge-base --is-ancestor b1 release; echo $?)" 0
t "close-chat: preview merge has two parents" "$(git rev-list --parents -1 release | wc -w | tr -d ' ')" 3
t "close-chat: all good is ready" "$(ch b1 | tail -1 | grep -c '^READY to close b1')" 1
t "close-chat: already merged" "$(chw b1 'PASS merge: .* is already in release')" 1
wk b2 f.txt two
t "close-chat: clash fails and names the file" "$(chw b2 'FAIL merge: clashes with release in f.txt')" 1
wk b3 g.txt three
t "close-chat: merge that adds something runs the checks" "$(chw b3 'PASS checks: `test ! -e bad.txt` passed')" 1
t "close-chat: then ready" "$(ch b3 | tail -1 | grep -c '^READY')" 1
wk b4 bad.txt four; before=$(git rev-parse release)
t "close-chat: failing checks fail" "$(chw b4 'FAIL checks: .* failed on the merge')" 1
t "close-chat: failing checks leave the preview alone" "$(git rev-parse release)" "$before"
echo '{"level":1}' > .claude/chat-hub.json
t "close-chat: no checks command fails" "$(chw b4 'FAIL checks: no `checks` command')" 1
git checkout -q -- .claude/chat-hub.json
git branch b5 main
t "close-chat: branch without a folder fails" "$(chw b5 'FAIL folder: no worktree has b5')" 1
git worktree add -q ../rel release
t "close-chat: preview checked out somewhere fails" "$(chw b3 'FAIL preview: release is checked out')" 1
git worktree remove --force ../rel
cd "$tmp/cc/repo"
# run.mjs (the launcher) and the reload notice: two versions installed side by side
cache="$tmp/cache/chat-hub-core"; mkdir -p "$cache"
for v in 1.0.0 2.0.0; do
  mkdir "$cache/$v" && cp -R "$root/hooks" "$root/skills" "$root/.claude-plugin" "$cache/$v/"
  node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.version=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(j))' "$cache/$v/.claude-plugin/plugin.json" "$v"
done
vd=$(mktemp -d "$tmp/ver.XXXXXX"); ( cd "$vd" && git init -q -b main && mkdir .claude && echo '{"level":0}' > .claude/chat-hub.json && node "$root/hooks/set-hub.mjs" --session h1 >/dev/null )
pf="$vd/plugins.json"; vroot=$(cd "$vd" && pwd -P)
pj() { echo "{\"version\":2,\"plugins\":{\"chat-hub-core@chat-hub\":[{\"scope\":\"project\",\"projectPath\":\"$vroot\",\"installPath\":\"$1\",\"version\":\"x\"}]}}" > "$pf"; }
# lr <launcher's plugin folder> <hook> <session>: run a hook through that launcher, input from a file
lr() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],prompt:"hi",cwd:process.argv[2]}))' "$3" "$vd" > "$tmp/lr.json"
  (cd "$vd" && CHAT_HUB_PLUGINS_FILE="$pf" node "$1/hooks/run.mjs" "$2" < "$tmp/lr.json"); }
pj "$cache/2.0.0"
t "launcher: runs the installed version" "$(lr "$cache/1.0.0" session-start s1 | grep -c 'chat-hub-core 2.0.0 (level 0)')" 1
pj "$cache/9.9.9"
t "launcher: installed folder missing, runs its own" "$(lr "$cache/1.0.0" session-start s1 | grep -c 'chat-hub-core 1.0.0 (level 0)')" 1
echo '[1,2' > "$pf"
t "launcher: broken plugins file, runs its own" "$(lr "$cache/1.0.0" session-start s1 | grep -c 'chat-hub-core 1.0.0 (level 0)')" 1
pj "$cache/2.0.0"; mv "$cache/2.0.0/hooks/notes-check.mjs" "$tmp/nc.mjs"
t "launcher: hook missing there, runs its own" "$(lr "$cache/1.0.0" notes-check s1; echo "rc $?")" "rc 0"
mv "$tmp/nc.mjs" "$cache/2.0.0/hooks/notes-check.mjs"
rootv=$(node -p 'require(process.argv[1]).version' "$root/.claude-plugin/plugin.json")
t "launcher: --plugin-dir copy keeps its own" "$(lr "$root" session-start s1 | grep -c "chat-hub-core $rootv (level 0)")" 1
t "launcher: unknown hook name is quiet" "$(lr "$cache/1.0.0" '../x' s1 | wc -c | tr -d ' ')" 0
t "reload: hub told to read the new hub rules" "$(lr "$cache/1.0.0" on-prompt h1 | grep -c "updated to 2.0.0 (this chat started on 1.0.0).*read .*/2.0.0/skills/hub/SKILL.md")" 1
t "reload: work chat told to read work-chat rules" "$(lr "$cache/1.0.0" on-prompt w1 | grep -c "read .*/2.0.0/skills/work-chat/SKILL.md")" 1
t "reload: told once" "$(lr "$cache/1.0.0" on-prompt w1 | wc -c | tr -d ' ')" 0
t "reload: no restart when hooks.json is the same" "$(lr "$cache/1.0.0" on-prompt w2 | grep -c 'restart')" 0
t "reload: chat on the installed version not told" "$(lr "$cache/2.0.0" on-prompt w3 | wc -c | tr -d ' ')" 0
echo '{"hooks":{}}' > "$cache/2.0.0/hooks/hooks.json"
t "reload: restart when hooks.json changed" "$(lr "$cache/1.0.0" on-prompt w4 | grep -c 'restart this chat at your next stopping point')" 1
t "reload: hooks run directly are quiet" "$(cd "$vd" && CHAT_HUB_PLUGINS_FILE="$pf" node "$cache/2.0.0/hooks/on-prompt.mjs" < "$tmp/lr.json" | wc -c | tr -d ' ')" 0
nd=$(mktemp -d "${TMPDIR:-/tmp}/chat-hub-nogit.XXXXXX"); mkdir "$nd/.claude"; echo '{"level":0,"hubSession":"h1"}' > "$nd/.claude/chat-hub.json"
t "reload: no git, quiet" "$(cd "$nd" && CHAT_HUB_PLUGINS_FILE="$pf" CHAT_HUB_LOADED_ROOT="$cache/1.0.0" node "$cache/2.0.0/hooks/on-prompt.mjs" < "$tmp/lr.json" | wc -c | tr -d ' ')" 0
rm -rf "$nd"
# scripts/update-all.sh, with a fake claude that logs what it was asked
fb="$tmp/fakebin"; mkdir "$fb"; clog="$tmp/claude.log"; : > "$clog"
printf '#!/bin/sh\necho "$PWD | $*" >> "%s"\n[ -f "$PWD/fail-update" ] && [ "$2" = update ] && exit 1\nexit 0\n' "$clog" > "$fb/claude"; chmod +x "$fb/claude"
p1=$(cd "$vd" && pwd -P)
echo "{\"plugins\":{\"chat-hub-core@chat-hub\":[{\"scope\":\"project\",\"projectPath\":\"$p1\",\"version\":\"0.3.20\"},{\"scope\":\"project\",\"projectPath\":\"$tmp/gone\",\"version\":\"0.3.19\"}]}}" > "$pf"
ua() { PATH="$fb:$PATH" CHAT_HUB_PLUGINS_FILE="$pf" sh "$root/scripts/update-all.sh" "$@" 2>&1; }
uo=$(ua)
t "update-all: marketplace updated once" "$(grep -c 'marketplace update chat-hub' "$clog")" 1
t "update-all: plugin updated in the project" "$(grep -c "^$p1 | plugin update chat-hub-core@chat-hub --scope project" "$clog")" 1
t "update-all: missing project skipped" "$(echo "$uo" | grep -c "skip $tmp/gone: folder is gone")" 1
t "update-all: prints old and new" "$(echo "$uo" | grep -c "$p1: 0.3.20 -> 0.3.20")" 1
: > "$clog"; ua --dry-run >/dev/null
t "update-all: dry run runs nothing" "$(wc -c < "$clog" | tr -d ' ')" 0
touch "$vd/fail-update"
t "update-all: a failed update fails the run" "$(ua >/dev/null; echo $?)" 1
rm "$vd/fail-update"

t "skills: answered line in work chat" "$(grep -c 'answered, working again' "$root/skills/work-chat/SKILL.md")" 1
t "skills: OK asked with a menu" "$(grep -c 'Ask for it with a menu' "$root/skills/work-chat/SKILL.md")" 1
t "skills: answered line in hub" "$(grep -c 'answered, working again' "$root/skills/hub/SKILL.md")" 1
t "start modes: Just open in hub" "$(grep -c '\*\*Just open:\*\*' "$root/skills/hub/SKILL.md")" 1
t "start modes: wait is a startMode value" "$(grep -c '"plan", "build" or "wait"' "$root/skills/hub/SKILL.md")" 1
t "start modes: work chat handles Just open" "$(grep -c '"Just open": read your brief' "$root/skills/work-chat/SKILL.md")" 1
t "start modes: brief offers just open" "$(grep -c '"just open"' "$root/templates/brief.md")" 1
t "start modes: setup lists wait" "$(grep -c '"plan" | "build" | "wait"' "$root/skills/setup/SKILL.md")" 1
t "close: hub uses close-chat" "$(grep -c 'hooks/close-chat.mjs"' "$root/skills/hub/SKILL.md")" 1
t "close: hub sets ✅ with the READY" "$(grep -c 'right after that READY, in one step' "$root/skills/hub/SKILL.md")" 1
t "close: setup has checks" "$(grep -c '"checks": ""' "$root/skills/setup/SKILL.md")" 1
t "hub title: open count in parentheses" "$(grep -c "the \*\*open count\*\* in parentheses" "$root/skills/hub/SKILL.md")" 1
t "hub title: talk and ✅ chats not counted" "$(grep -c "Talk chats (no release tag), ✅ chats" "$root/skills/hub/SKILL.md")" 1
t "hub title: count only with other title changes" "$(grep -c "never retitle yourself just" "$root/skills/hub/SKILL.md")" 1

cd "$tmp"
rm -rf "$tmp"; exit $fail
