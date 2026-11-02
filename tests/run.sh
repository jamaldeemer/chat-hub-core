#!/bin/sh
# chat-hub-core's own checks: the hooks' messages and the pre-push gate, in throwaway repos.
set -u
root=$(cd "$(dirname "$0")/.." && pwd); fail=0
t() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: got [$2] want [$3]"; fail=1; fi; }
unset CLAUDE_CODE_HOST_SESSION_ID   # the desktop app's own address for the chat running the tests
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
# In the desktop app the hooks see this chat's app address (CLAUDE_CODE_HOST_SESSION_ID), which a clear keeps.
ssa() { printf '{"session_id":"%s"}' "$2" | CLAUDE_CODE_HOST_SESSION_ID="$1" node "$root/hooks/session-start.mjs"; }
t "app address: cleared hub told it is the hub" "$(ssa local_A s7 | grep -c 'This chat is the hub (the app gives.*never the work-chat skill.*hub-notes.md before anything else')" 1
t "app address: cleared hub not asked to look itself up" "$(ssa local_A s7 | grep -c 'if its id is\|Otherwise this is a work chat')" 0
t "app address: cleared hub's new session ID recorded" "$(grep -c '"session":"s7","app":"local_A"' .git/chat-hub/hub)" 1
t "app address: work chat told so outright" "$(ssa local_Z s6 | grep -c 'This chat is a work chat (its app address is local_Z; the hub is local_A).*only ever message local_A')" 1
t "app address: work chat not told to read the notes" "$(ssa local_Z s6 | grep -c 'hub-notes.md')" 0
t "app address: cleared hub told to recount and prune" "$(ssa local_A s7 | grep -c 'drop chats the owner deleted from your notes and fix your title')" 1
t "app address: work chat not told to recount" "$(ssa local_Z s6 | grep -c 'owner deleted')" 0
printf '## Me\nx\n## Next\n- code E10 next\n- After clear: close E8 (report in)\n- after the clear: tell E7 to merge main\n## Plans\n- After clear: not this one\n' > .git/chat-hub/hub-notes.md
t "after clear: start note quotes the Next items" "$(ssa local_A s7 | grep -c 'put off until after the clear; do it first.*close E8 (report in).*tell E7 to merge main')" 1
t "after clear: only from ## Next" "$(ssa local_A s7 | grep -c 'not this one')" 0
t "after clear: none, nothing quoted" "$(printf '## Next\n- E10\n' > .git/chat-hub/hub-notes.md; ssa local_A s7 | grep -c 'put off')" 0
node "$root/hooks/set-hub.mjs" --session s5 --app local_A >/dev/null
t "app address: hub without one gets it recorded" "$(node "$root/hooks/set-hub.mjs" --session s10 --replace >/dev/null; ssa local_D s10 | grep -c -- '--app'; grep -c '"session":"s10","app":"local_D"' .git/chat-hub/hub)" "0
1"
node "$root/hooks/set-hub.mjs" --session s5 --app local_A --replace >/dev/null
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
printf '## Me\nx\n## Open chats\n- ✅ ʀ11 C8 · Newest version\n- R11 C9 · Old tag\n' > .git/chat-hub/hub-notes.md
nc s5 >/dev/null
t "notes check: ✅ chat with a ʀ tag flagged" "$(nd 'still list ✅ (closed) chats: \\"✅ ʀ11 C8')" 1
t "notes check: open chat with an old R tag not flagged" "$(nd 'R11 C9')" 0
printf '## Me\nx\n## Open chats\n- ✅ ʀ11 C7 · (Next release name)\n- ʀ11 C6 · (Open next release)\n- ʀ12 C5 · Later release\n' > .git/chat-hub/hub-notes.md
nc s5 >/dev/null
t "notes check: ✅ chat with name in parentheses flagged" "$(nd 'still list ✅ (closed) chats: \\"✅ ʀ11 C7 · (Next release name)')" 1
t "notes check: open chats with and without parentheses not flagged" "$(nd 'C6 · \|C5 · ')" 0
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
ss() { printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","source":"%s"}' "$1" "$2" "$(pwd)" "$3" | node "$root/hooks/session-start.mjs"; }
t "start stats: off when stats is false" "$(ss u1 "$tr" resume | grep -c systemMessage)" 0
echo '{"level":0}' > .claude/chat-hub.json
ver=$(node -p 'require(process.argv[1]).version' "$root/.claude-plugin/plugin.json")
t "start stats: new chat shows the version" "$(ss u9 "$tmp/none.jsonl" startup | grep -c "^{\"systemMessage\":\"chat-hub-core $ver · new chat\",")" 1
t "start stats: resume shows the real numbers" "$(ss u1 "$tr" resume | grep -c "\"systemMessage\":\"chat-hub-core $ver · Context 200k · 3 turns · this chat ≈ 204k token-reads\"")" 1
t "start stats: after a compact, no stale context" "$(ss u1 "$tr" compact | grep -c '"systemMessage":"[^"]*Context compacted · 3 turns')" 1
t "start stats: Claude still gets the start note" "$(ss u9 "$tmp/none.jsonl" startup | grep -c 'additionalContext":"This project uses chat-hub-core')" 1
# titles.mjs: the after-turn title check reads the app's custom-title.json next to the transcript.
ttl() { mkdir -p "$tmp/$1"; printf '{"customTitle":"%s"}' "$2" > "$tmp/$1/custom-title.json"; }
atb() { printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","stop_hook_active":%s}' "$1" "$tr" "$(pwd)" "${2:-false}" | node "$root/hooks/after-turn.mjs"; }
ttl u1 '🔨  ʀ26~ 2F · More menu fixes'
t "title check: a good title passes" "$(atb u1 | grep -c '"decision"')" 0
t "title check: stats line still shown" "$(atb u1 | grep -c '"systemMessage":"chat-hub-core')" 1
ttl u1 '❓ ʀ25+ 7F · (Gaps in the pieces)'
t "title check: one space sent back" "$(atb u1 | grep -c '"decision":"block".*two spaces after the symbol, not 1.*e.g. \\"❓  ʀ25+ 7F')" 1
t "title check: never twice in a row" "$(atb u1 true | grep -c '"decision"')" 0
ttl u1 '🔨  R26~ 8E · Menus polish'
t "title check: plain R sent back with the fix" "$(atb u1 | grep -c 'plain R.*e.g. \\"🔨  ʀ26~ 8E')" 1
ttl u1 '🔨  3F · Fix menu (R7)'
t "title check: code-first plain R too" "$(atb u1 | grep -c 'e.g. \\"🔨  3F · Fix menu (ʀ7)')" 1
ttl u1 'ʀ25+ 9C · (Better examples)'
t "title check: missing symbol sent back" "$(atb u1 | grep -c 'no status symbol')" 1
ttl u1 '⚪  ʀ26~ 4F · Performance regression'
t "title check: work chat on ⚪ sent back" "$(atb u1 | grep -c '⚪ is only for talk chats and the hub')" 1
ttl u1 '⚪  ᴢ N12 · Product positioning'
t "title check: talk chat keeps ⚪" "$(atb u1 | grep -c '"decision"')" 0
ttl u1 'M6 Mac Mini uses'
t "title check: app-made title left alone" "$(atb u1 | grep -c '"decision"')" 0
t "title check: no title file, nothing checked" "$(atb u7 | grep -c '"decision"')" 0
echo '{"level":0,"hubSession":"u1"}' > .claude/chat-hub.json
ttl u1 '⚪  object_creator HUB · ʀ25+ (4)'
t "title check: hub keeps ⚪" "$(atb u1 | grep -c '"decision"')" 0
echo '{"level":0,"stats":false}' > .claude/chat-hub.json
ttl u1 '❓ ʀ25+ 7F · x'
t "title check: runs with stats off" "$(atb u1 | grep -c '"decision":"block"')" 1
rm -rf "$tmp/u1"
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
node "$root/hooks/set-hub.mjs" --session u1 --replace >/dev/null
op() { printf '{"session_id":"%s","prompt":"hi","cwd":"%s"}' "$1" "$(pwd)" | node "$root/hooks/on-prompt.mjs"; }
pt() { j=$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:process.argv[3],tool_input:JSON.parse(process.argv[4])}))' "$1" "$(pwd)" "$2" "$3"); printf "%s" "$j" | node "$root/hooks/guard.mjs"; }
asst m4 0 160000; at u1 >/dev/null
# trim: at trimAt the hub wraps up (no new work, finish what's in flight, notes, then the SAFE TO CLEAR banner)
t "wrap up: hub past trimAt" "$(op u1 | grep -c 'WRAP UP.*past its limit of 150k.*no new work.*## Next.*in flight.*plain line .*wrapping up.*notes up to date.*SAFE TO CLEAR: type /clear.*Never ask the owner about clearing.*no ask or actions')" 1
t "wrap up: says when the hard stop comes" "$(op u1 | grep -c 'At 170k tokens the hooks refuse every tool but your notes')" 1
t "wrap up: says how the owner lifts it" "$(op u1 | grep -c 'Only the owner can lift this: they type /chat-hub-core:limit <a higher limit.*/chat-hub-core:limit off')" 1
t "wrap up: on every prompt" "$(op u1 | grep -c 'WRAP UP')" 1
t "wrap up: no hard stop yet" "$(op u1 | grep -c 'HARD STOP')" 0
asst m6 0 50000; at u1 >/dev/null; op u1 >/dev/null
t "wrap up: quiet after a clear" "$(op u1 | wc -c | tr -d ' ')" 0
asst m7 0 151000; at u1 >/dev/null
t "wrap up: once on a tool call when crossed" "$(pt u1 Read '{"file_path":"x"}' | grep -c 'WRAP UP')" 1
t "wrap up: not again on tool calls" "$(pt u1 Read '{"file_path":"x"}' | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":200000}' > .claude/chat-hub.json
t "wrap up: trimAt sets the limit" "$(op u1 | wc -c | tr -d ' ')" 0
echo '{"level":0}' > .claude/chat-hub.json
t "wrap up: default limit is 135k" "$(op u1 | grep -c 'past its limit of 135k')" 1
asst m8 0 134000; at u1 >/dev/null
t "wrap up: quiet under 135k by default" "$(op u1 | wc -c | tr -d ' ')" 0
asst m9 0 136000; at u1 >/dev/null
t "wrap up: closing chats whose report is in counts as in flight" "$(op u1 | grep -c 'closing every chat whose wrap-up report is in.*never leave one at ⏳')" 1
t "wrap up: put-off work noted as After clear" "$(op u1 | grep -c 'starting .*- After clear:')" 1
node "$root/hooks/set-hub.mjs" --session u1 --app local_H >/dev/null
opa() { printf '{"session_id":"%s","prompt":"hi","cwd":"%s"}' "$2" "$(pwd)" | CLAUDE_CODE_HOST_SESSION_ID="$1" node "$root/hooks/on-prompt.mjs"; }
cp "$TMPDIR/chat-hub-core/u1.json" "$TMPDIR/chat-hub-core/u1c.json"
t "wrap up: hub known by app address before its new session ID is recorded" "$(opa local_H u1c | grep -c 'WRAP UP')" 1
t "wrap up: other app address not the hub" "$(opa local_W u1c | grep -c 'WRAP UP')" 0
echo '{"level":0,"trimAt":150000}' > .claude/chat-hub.json
asst m13 0 151000; at u2 >/dev/null
t "trim: work chats not by default" "$(op u2 | wc -c | tr -d ' ')" 0
echo '{"level":0,"trimAt":150000,"trimAtWork":100000}' > .claude/chat-hub.json
t "trim: work chats with trimAtWork" "$(op u2 | grep -c 'natural stopping point')" 1
t "trim: work chats show a plain line, then the banner" "$(op u2 | grep -c 'plain line .*This chat is at 151k tokens: wrapping up.*SAFE TO CLEAR: type /clear')" 1
t "trim: work chats never refused" "$(pt u2 mcp__ccd_session__start_session '{}' | grep -c '"deny"')" 0
# Hard stops for the hub: stage 1 at the limit (no new work), stage 2 at limit + hardStopAfter (notes only).
echo '{"level":1,"trimAt":150000,"done":["tests pass"]}' > .claude/chat-hub.json
node "$root/hooks/set-hub.mjs" --session u1 --replace >/dev/null
notes="$(pwd)/.git/chat-hub/hub-notes.md"
lp() { printf '{"session_id":"%s","prompt":"/chat-hub-core:limit %s","cwd":"%s"}' "$1" "$2" "$(pwd)" | node "$root/hooks/on-prompt.mjs"; }
den() { pt "$@" | grep -c '"permissionDecision":"deny"'; }
asst m20 0 151000; at u1 >/dev/null
t "stage 1: new chat refused" "$(den u1 mcp__ccd_session__start_session '{"title":"x"}')" 1
t "stage 1: refusal says no new chats" "$(pt u1 mcp__ccd_session__start_session '{}' | grep -c 'past its limit of 150k, so no new work: no new chats.*After clear:')" 1
t "stage 1: refusal names the override" "$(pt u1 mcp__ccd_session__start_session '{}' | grep -c 'owner can lift this: they type /chat-hub-core:limit')" 1
t "stage 1: new tag refused" "$(den u1 Bash '{"command":"git tag v0.3.42 release"}')" 1
t "stage 1: annotated tag refused" "$(den u1 Bash '{"command":"git -C /x tag -a v1 -m hi"}')" 1
t "stage 1: listing tags allowed" "$(den u1 Bash '{"command":"git tag -l | tail -3"}')" 0
t "stage 1: bare git tag allowed" "$(den u1 Bash '{"command":"git tag"}')" 0
t "stage 1: release commit refused" "$(den u1 Bash '{"command":"git commit -m \"Release 0.3.42 (R31): x\""}')" 1
t "stage 1: release branch reset refused" "$(den u1 Bash '{"command":"git checkout -B release main"}')" 1
t "stage 1: release branch via switch refused" "$(den u1 Bash '{"command":"git switch -C release origin/main"}')" 1
t "stage 1: release branch via branch -f refused" "$(den u1 Bash '{"command":"git branch -f release main"}')" 1
t "stage 1: checking out release allowed" "$(den u1 Bash '{"command":"git checkout release"}')" 0
t "stage 1: close-chat allowed" "$(den u1 Bash '{"command":"node /p/hooks/close-chat.mjs /wt/a"}')" 0
t "stage 1: merge allowed" "$(den u1 Bash '{"command":"git merge --no-ff claude/x"}')" 0
t "stage 1: merge commit allowed" "$(den u1 Bash '{"command":"git commit -m \"Merge branch x into release\""}')" 0
t "stage 1: messages allowed" "$(den u1 mcp__ccd_session_mgmt__send_message '{}')" 0
t "stage 1: titles allowed" "$(den u1 mcp__ccd_session_mgmt__set_session_title '{}')" 0
t "stage 1: reads allowed" "$(den u1 Read '{"file_path":"x"}')" 0
t "stage 1: reading the settings allowed" "$(den u1 Bash '{"command":"cat .claude/chat-hub.json"}')" 0
t "stage 1: hub can't change the limit itself" "$(den u1 Bash '{"command":"node /p/hooks/limit.mjs off"}')" 1
t "stage 1: nor rewrite limits.json" "$(den u1 Bash '{"command":"echo {} > .git/chat-hub/limits.json"}')" 1
t "stage 1: nor edit the settings" "$(den u1 Edit '{"file_path":".claude/chat-hub.json"}')" 1
t "stage 1: nor sed the settings" "$(den u1 Bash '{"command":"sed -i \"\" s/150000/300000/ .claude/chat-hub.json"}')" 1
t "stage 1: nor hand the hub away" "$(den u1 Bash '{"command":"node /p/hooks/set-hub.mjs --session zz --replace"}')" 1
t "stage 1: nor reset its usage counts" "$(den u1 Bash '{"command":"rm $TMPDIR/chat-hub-core/u1.json"}')" 1
t "stage 1: work chats still free" "$(den u2 mcp__ccd_session__start_session '{}')" 0
asst m21 0 171000; at u1 >/dev/null
t "stage 2: prompt note is the hard stop" "$(op u1 | grep -c 'HARD STOP.*171k.*except reading and writing your hub notes.*SAFE TO CLEAR: type /clear.*/chat-hub-core:limit')" 1
t "stage 2: prompt note names the notes file" "$(op u1 | grep -c "$notes")" 1
t "stage 2: Bash refused" "$(den u1 Bash '{"command":"ls"}')" 1
t "stage 2: close-chat refused" "$(den u1 Bash '{"command":"node /p/hooks/close-chat.mjs /wt/a"}')" 1
t "stage 2: messages refused" "$(den u1 mcp__ccd_session_mgmt__send_message '{}')" 1
t "stage 2: other files refused" "$(den u1 Read '{"file_path":"README.md"}')" 1
t "stage 2: refusal shows the banner and override" "$(pt u1 Bash '{"command":"ls"}' | grep -c 'HARD STOP.*SAFE TO CLEAR: type /clear.*/chat-hub-core:limit off')" 1
t "stage 2: reading the notes allowed" "$(den u1 Read "{\"file_path\":\"$notes\"}")" 0
t "stage 2: editing the notes allowed" "$(den u1 Edit "{\"file_path\":\"$notes\"}")" 0
t "stage 2: writing the notes allowed" "$(den u1 Write "{\"file_path\":\"$notes\"}")" 0
t "stage 2: wrap-up box allowed" "$(den u1 mcp__ccd_turn__wrap_up '{}')" 0
echo '{"level":1,"trimAt":150000,"hardStopAfter":40000,"done":["tests pass"]}' > .claude/chat-hub.json
t "hardStopAfter moves stage 2" "$(den u1 Bash '{"command":"ls"}')" 0
t "hardStopAfter: still stage 1" "$(den u1 Bash '{"command":"git tag v9"}')" 1
t "hardStopAfter: shown by /limit" "$(node "$root/hooks/limit.mjs" | grep -c 'at 190k (40k more, hardStopAfter)')" 1
echo '{"level":1,"trimAt":150000,"done":["tests pass"]}' > .claude/chat-hub.json
t "override: /limit 300k lifts both stages" "$(lp u1 300k | grep -c 'Saved.*stop and carry on as normal'); $(den u1 Bash '{"command":"ls"}'); $(den u1 mcp__ccd_session__start_session '{}')" "1; 0; 0"
t "override: /limit off lifts them too" "$(lp u1 off >/dev/null; den u1 Bash '{"command":"git tag v9"}')" 0
t "override: /limit 160k is stage 1 again" "$(lp u1 160k >/dev/null; den u1 Bash '{"command":"ls"}'); $(den u1 Bash '{"command":"git tag v9"}')" "0; 1"
node "$root/hooks/limit.mjs" default >/dev/null
asst m22 0 50000; at u1 >/dev/null
t "after a clear: nothing refused" "$(den u1 mcp__ccd_session__start_session '{}')" 0
# The guard reads the transcript itself, so a long turn is stopped mid-turn, before the after-turn hook.
asst m23 0 175000
ptt() { j=$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],transcript_path:process.argv[3],tool_name:"Bash",tool_input:{command:"ls"}}))' "$1" "$(pwd)" "$tr"); printf "%s" "$j" | node "$root/hooks/guard.mjs"; }
t "mid-turn: guard sees the new context" "$(ptt u1 | grep -c 'HARD STOP')" 1
asst m24 0 136000; at u1 >/dev/null
echo '{"level":0,"trimAt":150000,"trimAtWork":100000}' > .claude/chat-hub.json
# /chat-hub-core:limit: changes the limits from the next prompt, for every worktree, never in the settings
t "limit: shows both limits" "$(node "$root/hooks/limit.mjs" | grep -c 'hub wraps up at 150k (from .claude/chat-hub.json); work chats are asked to stop at 100k')" 1
t "limit: hub limit set from the prompt" "$(lp u1 200k | grep -c 'Saved.*hub wraps up at 200k (set with /chat-hub-core:limit).*already done')" 1
t "limit: hub under the new limit is told to stop wrapping up" "$(lp u1 200k | grep -c 'stop and carry on as normal')" 1
t "limit: no WRAP UP under the new limit" "$(op u1 | grep -c 'WRAP UP')" 0
t "limit: settings file untouched" "$(grep -c '"trimAt":150000' .claude/chat-hub.json)" 1
t "limit: seen from another worktree" "$(git -c user.email=a@b -c user.name=t worktree add -q ../wt4 2>/dev/null; cd ../wt4 && node "$root/hooks/limit.mjs" | grep -c "hub wraps up at 200k (set with"; cd - >/dev/null; git worktree remove --force ../wt4)" 1
lp u1 130k >/dev/null
t "limit: lowered below the context, WRAP UP comes" "$(op u1 | grep -c 'past its limit of 130k')" 1
t "limit: a new limit nudges once more on a tool call" "$(node "$root/hooks/limit.mjs" 132k >/dev/null; pt u1 Read '{"file_path":"x"}' | grep -c 'past its limit of 132k')" 1
t "limit: work chats" "$(lp u2 'work 160k' >/dev/null; op u2 | wc -c | tr -d ' ')" 0
t "limit: work off" "$(lp u2 'work off' | grep -c 'work chats have no limit (set with')" 1
t "limit: 200 means 200k" "$(node "$root/hooks/limit.mjs" hub 200 | grep -c 'wraps up at 200k')" 1
t "limit: too small refused" "$(node "$root/hooks/limit.mjs" 5k | grep -c 'Not changed.*outside')" 1
t "limit: nonsense refused" "$(node "$root/hooks/limit.mjs" lots | grep -c 'Not changed.*isn.t a size')" 1
t "limit: default goes back to the settings" "$(node "$root/hooks/limit.mjs" default | grep -c 'hub wraps up at 150k (from .claude/chat-hub.json); work chats are asked to stop at 100k (from')" 1
ln -s "$root" "$tmp/linked-root"
t "limit: runs when reached through a symlinked path" "$(node "$tmp/linked-root/hooks/limit.mjs" | grep -c 'hub wraps up at 150k')" 1
rm "$tmp/linked-root"
# /chat-hub-core:tools: deny rules in the main checkout's settings.local.json, owner's own rules kept
tl() { printf '{"session_id":"u1","prompt":"/chat-hub-core:tools %s","cwd":"%s"}' "$1" "$(pwd)" | node "$root/hooks/on-prompt.mjs"; }
printf '{"permissions":{"allow":["Bash(ls)"],"deny":["Bash(rm *)"]},"model":"x"}\n' > .claude/settings.local.json
t "start note: no tools off, no line" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'turned off')" 0
t "tools: lists every group, numbered" "$(node "$root/hooks/tools.mjs" | grep -cE '^ ?[0-9]+\. ')" 27
t "tools: names the always-on tools" "$(node "$root/hooks/tools.mjs" | grep -c '^Always on.*Bash.*SendMessage')" 1
t "tools: off from the prompt" "$(tl 'off browser ios' | grep -c '/tools: Saved.*Off: browser, ios.*already done')" 1
t "tools: server rules written" "$(grep -c '"mcp__Claude_Browser"\|"mcp__Claude_Code_iOS_Simulator"' .claude/settings.local.json)" 2
t "tools: owner's own settings kept" "$(grep -c 'Bash(rm\|"Bash(ls)"\|"model"' .claude/settings.local.json)" 3
t "tools: seen from another worktree" "$(git -c user.email=a@b -c user.name=t worktree add -q ../wt5 2>/dev/null; cd ../wt5 && node "$root/hooks/tools.mjs" off charts >/dev/null; cd - >/dev/null; git worktree remove --force ../wt5; grep -c '"mcp__visualize"' .claude/settings.local.json)" 1
t "tools: nothing to change" "$(node "$root/hooks/tools.mjs" off ios | grep -c 'Nothing to change')" 1
t "tools: on removes only ours" "$(node "$root/hooks/tools.mjs" on all >/dev/null; grep -c 'mcp__' .claude/settings.local.json; grep -c 'Bash(rm' .claude/settings.local.json)" "0
1"
t "tools: off unused keeps the browser" "$(node "$root/hooks/tools.mjs" off unused >/dev/null; grep -c '"Workflow"\|"mcp__Claude_Browser"' .claude/settings.local.json)" 1
t "tools: off by number and range" "$(node "$root/hooks/tools.mjs" on all >/dev/null; node "$root/hooks/tools.mjs" off 4 1-2 >/dev/null; node "$root/hooks/tools.mjs" | grep -cE '^ ?[0-9]+\. off ')" 3
t "tools: bad number refused" "$(node "$root/hooks/tools.mjs" off 99 | grep -c 'no group numbered 99')" 1
t "tools: single tool off and listed" "$(node "$root/hooks/tools.mjs" off Foo >/dev/null; node "$root/hooks/tools.mjs" | grep -c '^Also off: .*Foo')" 1
t "tools: part of a group shows part" "$(node "$root/hooks/tools.mjs" off SendUserFile ListAgents >/dev/null; node "$root/hooks/tools.mjs" | grep -c 'part agents')" 1
t "start note: names the tools that are off" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'Tools turned off in this project: browser, ios, artifacts, files, Foo, ListAgents\. If you need one, ask the owner to type `/chat-hub-core:tools on <name>`')" 1
t "tools: needed tools stay on" "$(node "$root/hooks/tools.mjs" off Bash mcp__ccd_session_mgmt__send_message | grep -c 'Not changed: chat-hub-core needs Bash, mcp__ccd_session_mgmt__send_message')" 1
t "tools: odd word refused" "$(node "$root/hooks/tools.mjs" off "a/b" | grep -c "Not changed: \"a/b\" isn.t a group or tool name")" 1
t "tools: nonsense refused" "$(node "$root/hooks/tools.mjs" maybe | grep -c 'Not changed: didn.t understand')" 1
rm .claude/settings.local.json
t "tools: no settings file yet, created" "$(node "$root/hooks/tools.mjs" off workflows >/dev/null; grep -c '"Workflow"' .claude/settings.local.json)" 1
rm .claude/settings.local.json
# Default off: ios, artifacts and the unused extras, once per project; a group turned back on stays on
rm -f .git/chat-hub/tools.json; printf '{"permissions":{"deny":["Bash(rm *)"]}}\n' > .claude/settings.local.json
t "defaults: start note says what it turned off" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'turned these tool groups off by default.*: ios, artifacts, chrome, workflows,.*worktrees (this chat still has them')" 1
t "defaults: this chat's own off note unchanged" "$(rm -f .git/chat-hub/tools.json; printf '{}\n' > .claude/settings.local.json; echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'Tools turned off in this project')" 0
t "defaults: rules written, browser kept" "$(grep -c '"mcp__Claude_Code_iOS_Simulator"\|"Artifact"\|"Workflow"\|"mcp__ccd_pr"\|"EnterWorktree"\|"mcp__Claude_Browser"' .claude/settings.local.json)" 5
t "defaults: 17 groups off in the list" "$(node "$root/hooks/tools.mjs" | grep -cE '^ ?[0-9]+\. off ')" 17
t "defaults: list names them" "$(node "$root/hooks/tools.mjs" | grep -c '^Off by default.*2\. ios, 4\. artifacts, 13\. chrome')" 1
t "defaults: next chat's note lists them" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'Tools turned off in this project: ios, artifacts, chrome')" 1
t "defaults: applied once" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'by default')" 0
node "$root/hooks/tools.mjs" on ios Workflow >/dev/null
rm -f .claude/settings.local.json
t "defaults: turned back on stays on" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'by default'; grep -c '"Artifact"' .claude/settings.local.json 2>/dev/null || echo 0)" "0
0"
node "$root/hooks/tools.mjs" off 4 >/dev/null
printf '{"applied":["ios","artifacts","workflows"]}\n' > .git/chat-hub/tools.json
t "defaults: owner's "on" kept, new ones applied" "$(echo '{}' | node "$root/hooks/session-start.mjs" | grep -c 'by default.*: chrome, suggestions'; grep -c '"mcp__Claude_Code_iOS_Simulator"\|"Workflow"' .claude/settings.local.json)" "1
0"
rm -f .git/chat-hub/tools.json .claude/settings.local.json
t "defaults: "on" before they ran is kept" "$(node "$root/hooks/tools.mjs" on artifacts >/dev/null; echo '{}' | node "$root/hooks/session-start.mjs" >/dev/null; grep -c '"Artifact"' .claude/settings.local.json; grep -c '"mcp__claude-in-chrome"' .claude/settings.local.json)" "0
1"
rm -f .git/chat-hub/tools.json .claude/settings.local.json
t "defaults: prompt hook applies them too" "$(echo '{"session_id":"u9","prompt":"hello"}' | node "$root/hooks/on-prompt.mjs" | grep -c 'turned these tool groups off by default')" 1
t "defaults: prompt hook only once" "$(echo '{"session_id":"u9","prompt":"hello"}' | node "$root/hooks/on-prompt.mjs" | grep -c 'by default')" 0
rm -f .git/chat-hub/tools.json; printf '{"permissions":{"deny":["Bash(rm *)"]}}\n' > .claude/settings.local.json
t "defaults: /tools on in the same prompt wins" "$(tl 'on ios' >/dev/null; grep -c '"mcp__Claude_Code_iOS_Simulator"' .claude/settings.local.json; grep -c '"Artifact"\|Bash(rm' .claude/settings.local.json)" "0
2"
rm .claude/settings.local.json
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
# After a clear or restart: a level-2 work chat with a pushed head is told its CI state (its watcher died).
(cd "$wt" && node "$root/hooks/set-hub.mjs" --session h1 >/dev/null)
ssw() { (cd "$wt" && printf '{"session_id":"%s"}' "$1" | node "$root/hooks/session-start.mjs"); }
cfg2() { node -e 'process.stdout.write(JSON.stringify({level:2,ci:{passed:process.argv[1]}}))' "$1" > "$wt/.claude/chat-hub.json"; }
t "ci note: passed, set 🟢 and ask" "$(cfg2 'echo 1'; ssw s2 | grep -c 'CI passed on your pushed branch head [0-9a-f]\{7\}. If your title still shows 🚀, set 🟢 now')" 1
t "ci note: not passed, restart the watcher" "$(cfg2 'echo 0'; ssw s2 | grep -c "hasn't passed on it yet. A clear or restart stopped any CI watcher.*start the watcher again in the background")" 1
t "ci note: can't ask, still told to look" "$(cfg2 'exit 1'; ssw s2 | grep -c "couldn't be asked about it.*look at the run")" 1
t "ci note: asks about the branch head" "$(cfg2 "test \"\$SHA\" = $(git rev-parse a2-work) && echo 1 || echo 0"; ssw s2 | grep -c 'CI passed on your pushed')" 1
t "ci note: the hub isn't told" "$(cfg2 'echo 1'; ssw h1 | grep -c 'CI passed\|CI watcher')" 0
t "ci note: level 1 not told" "$(echo '{"level":1}' > "$wt/.claude/chat-hub.json"; ssw s2 | grep -c 'CI watcher\|CI passed')" 0
echo z > "$wt/h.txt"; git -C "$wt" add h.txt; git -C "$wt" -c user.email=a@b -c user.name=t commit -q -m "A2: z"
t "ci note: unpushed head not told" "$(cfg2 'echo 1'; ssw s2 | grep -c 'CI watcher\|CI passed')" 0
# ci-status.mjs: the hub's list of chat branches and their CI state.
cp "$wt/.claude/chat-hub.json" .claude/chat-hub.json
t "ci-status: unpushed commits shown" "$(node "$root/hooks/ci-status.mjs" | grep -c '^a2-work [0-9a-f]\{7\} 1 commit(s) not pushed$')" 1
git -C "$wt" push -q origin HEAD
t "ci-status: pushed and passed" "$(node "$root/hooks/ci-status.mjs" | grep -c '^a2-work [0-9a-f]\{7\} CI passed$')" 1
t "ci-status: main and release left out" "$(node "$root/hooks/ci-status.mjs" | grep -c '^main \|^release ')" 0
t "ci-status: not passed yet" "$(echo '{"level":2,"ci":{"passed":"echo 0"}}' > .claude/chat-hub.json; node "$root/hooks/ci-status.mjs" a2-work | grep -c 'CI not passed yet')" 1
t "ci-status: branch never pushed" "$(git branch lone; node "$root/hooks/ci-status.mjs" lone | grep -c '^lone [0-9a-f]\{7\} not pushed$')" 1
t "ci-status: level 1 has no CI" "$(echo '{"level":1}' > .claude/chat-hub.json; node "$root/hooks/ci-status.mjs" | grep -c 'no CI to ask')" 1
git checkout -q -- .claude/chat-hub.json; git -C "$wt" checkout -q -- .claude/chat-hub.json
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
wk b4 bad.txt four; before=$(git rev-parse release); copies=$(ls "${TMPDIR:-/tmp}" | grep -c '^chat-hub-close-')
t "close-chat: failing checks fail" "$(chw b4 'FAIL checks: .* failed on the merge')" 1
t "close-chat: failing checks leave the preview alone" "$(git rev-parse release)" "$before"
echo '{"level":1}' > .claude/chat-hub.json
t "close-chat: no checks command fails" "$(chw b4 'FAIL checks: no `checks` command')" 1
git checkout -q -- .claude/chat-hub.json
git branch b5 main
t "close-chat: branch without a folder fails" "$(chw b5 'FAIL folder: no worktree has b5')" 1
git worktree add -q ../rel release
t "close-chat: preview checked out somewhere else fails" "$(chw b3 'FAIL preview: release is checked out at .*; run this there')" 1
git worktree remove --force ../rel
echo '{"level":1,"done":["passes (`test ! -e bad.txt`)"]}' > .claude/chat-hub.json
wk b6 h.txt six
t "close-chat: no checks runs the commands in done, and says so" "$(chw b6 'PASS checks: `test ! -e bad.txt` passed on the merge (no `checks` in the settings; ran the commands in `done`')" 1
echo '{"level":1,"done":["tests pass"]}' > .claude/chat-hub.json
git worktree add -q ../b7 -b b7 main && mkdir ../b7/tests && echo 'exit 0' > ../b7/tests/run.sh && git -C ../b7 add -A && git -C ../b7 -c user.email=a@b -c user.name=t commit -q -m b7 && git -C ../b7 push -q origin HEAD
t "close-chat: no checks in settings or done runs a default from the merge" "$(chw b7 'PASS checks: `sh tests/run.sh` passed on the merge (no `checks` in the settings; ran the default (tests/run.sh)')" 1
t "close-chat: no temp copies left behind" "$(ls "${TMPDIR:-/tmp}" | grep -c '^chat-hub-close-')" "$copies"
git checkout -q -- .claude/chat-hub.json
git checkout -q release
wk b8 i.txt eight
echo dirt >> f.txt
t "close-chat: preview checked out here with changes fails" "$(chw b8 'FAIL preview: release is checked out here with 1 uncommitted')" 1
git checkout -q -- f.txt
out=$(ch b8)
t "close-chat: preview checked out here merges here" "$(echo "$out" | grep -c 'PASS preview: release is checked out here')" 1
t "close-chat: merging here is ready" "$(echo "$out" | tail -1 | grep -c '^READY to close b8')" 1
t "close-chat: merging here updates the files" "$(cat i.txt 2>/dev/null)" eight
t "close-chat: merging here leaves the folder clean" "$(git status --porcelain | wc -l | tr -d ' ')" 0
git checkout -q main
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
t "reload: owner shown just Updated" "$(lr "$cache/1.0.0" on-prompt w5 | grep -c '^{"systemMessage":"Updated",')" 1
t "reload: model told to say nothing about it" "$(lr "$cache/1.0.0" on-prompt w6 | grep -c 'say nothing about the update')" 1
t "reload: told once" "$(lr "$cache/1.0.0" on-prompt w1 | wc -c | tr -d ' ')" 0
t "reload: no restart when hooks.json is the same" "$(lr "$cache/1.0.0" on-prompt w2 | grep -c 'restart')" 0
t "reload: chat on the installed version not told" "$(lr "$cache/2.0.0" on-prompt w3 | wc -c | tr -d ' ')" 0
echo '{"hooks":{}}' > "$cache/2.0.0/hooks/hooks.json"
t "reload: restart when hooks.json changed" "$(lr "$cache/1.0.0" on-prompt w4 | grep -c '"systemMessage":"Updated: restart this chat".*the owner was told to restart this chat')" 1
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
# /chat-hub-core:version: installed version from the plugins file, newest from origin's v* tags
mo="$tmp/mkt-origin"; mk="$tmp/mkt"; g() { git -c user.email=a@b -c user.name=t "$@"; }
git init -q -b main "$mo" && mkdir "$mo/.claude-plugin" && echo '{"version":"0.3.21"}' > "$mo/.claude-plugin/plugin.json"
(cd "$mo" && g add -A && g commit -q -m one && g tag v0.3.9 && g tag v0.3.21 && g tag v0.3.10 && g tag notes) && git clone -q "$mo" "$mk"
vv() { (cd "$vd" && CHAT_HUB_PLUGINS_FILE="$pf" CHAT_HUB_MARKETPLACE="$1" node "$root/hooks/version.mjs"); }
t "version: installed from the plugins file" "$(vv "$mk" | grep -c '^This project runs chat-hub-core 0.3.20\.')" 1
t "version: newest tag, numeric order" "$(vv "$mk" | grep -c 'Newer: 0.3.21 is out (newest tag on GitHub).*update-all.sh')" 1
(cd "$mo" && g tag v0.3.20 HEAD >/dev/null; git tag -d v0.3.21 v0.3.10 >/dev/null)
t "version: up to date" "$(vv "$mk" | grep -c "That's the newest (newest tag on GitHub)")" 1
(cd "$mk" && git remote set-url origin "$tmp/no-such-origin")
t "version: no GitHub, marketplace copy" "$(vv "$mk" | grep -c 'Newer: 0.3.21 is out (marketplace copy; GitHub not reached)')" 1
t "version: no marketplace" "$(vv "$tmp/nope" | grep -c "Couldn't find the newest version")" 1
t "version: from the prompt" "$(cd "$vd" && echo '{"session_id":"v1","prompt":"/chat-hub-core:version"}' | CHAT_HUB_PLUGINS_FILE="$pf" CHAT_HUB_MARKETPLACE="$mk" node "$root/hooks/on-prompt.mjs" | grep -c '/version: This project runs chat-hub-core 0.3.20.*Tell the owner')" 1
t "version: from the prompt before setup" "$(cd "$mo"; echo '{"session_id":"v1","prompt":"/chat-hub-core:version"}' | CHAT_HUB_MARKETPLACE="$mk" node "$root/hooks/on-prompt.mjs" | grep -c '/version: This project runs')" 1

t "titles: work chat sets its own symbol" "$(grep -c 'set it (`set_session_title` with `self`)' "$root/skills/work-chat/SKILL.md")" 1
t "skills: OK asked with a menu" "$(grep -c 'Ask for it with a menu' "$root/skills/work-chat/SKILL.md")" 1
t "skills: more or wrap up asked with a menu" "$(grep -c 'should I wrap up?" with a menu' "$root/skills/work-chat/SKILL.md")" 1
t "skills: menu has Wrap up / More changes" "$(grep -c 'options \"Wrap up\" / \"More changes\"' "$root/skills/work-chat/SKILL.md")" 1
t "titles: More changes sets 🔨" "$(grep -c '"More changes" → set 🔨' "$root/skills/work-chat/SKILL.md")" 1
t "titles: hub closes when the report arrives" "$(grep -c 'When a wrap-up report arrives, close the chat' "$root/skills/hub/SKILL.md")" 1
t "skills: hub expects the Wrap up menu answer" "$(grep -c 'should I wrap up?" menu' "$root/skills/hub/SKILL.md")" 1
t "titles: hub keeps a chat's symbol when retitling" "$(grep -c 'keep its symbol' "$root/skills/hub/SKILL.md")" 1
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
t "hub title: count set with other title changes" "$(grep -c "set it in the same batch of title" "$root/skills/hub/SKILL.md")" 1
t "hub title: recount on every wake" "$(grep -c "recount on every wake" "$root/skills/hub/SKILL.md")" 1
t "hub title: retitle only when the count is wrong" "$(grep -c "retitle yourself only if your" "$root/skills/hub/SKILL.md")" 1
t "hub notes: deleted chats dropped by session id" "$(grep -c "match on session id, never title" "$root/skills/hub/SKILL.md")" 1
t "hub notes: unmerged deleted chat told once" "$(grep -c "tell the owner once (code, branch)" "$root/skills/hub/SKILL.md")" 1
t "release tag: hub writes small-caps ʀ" "$(grep -c 'small-caps `ʀ` (U+0280), never a plain `R`' "$root/skills/hub/SKILL.md")" 1
t "release tag: digits and kind stay plain" "$(grep -c 'the digits and `~`/`+`$' "$root/skills/hub/SKILL.md")" 1
t "release tag: old plain-R titles still count" "$(grep -c 'old plain-`R` tag (`R07`, `(R7)`)' "$root/skills/hub/SKILL.md")" 1
t "release tag: R → ʀ retitled in one batch" "$(grep -c 'release tag is written (`R` → `ʀ`)' "$root/skills/hub/SKILL.md")" 1
t "release tag: no plain-R tag examples left" "$(cat "$root/skills/hub/SKILL.md" "$root/skills/setup/SKILL.md" "$root/README.md" "$root/docs/all-prompts.md" | grep -E 'R[0-9<]' | grep -vc 'old plain-`R` tag')" 0
t "release tag: README examples use ʀ" "$(grep -cE '^(⚪|🙋|❓|⏳|🚀|🔴|🟢|🔨|✅)  (Hub · )?ʀ07' "$root/README.md")" 10
t "release tag: README explains ʀ" "$(grep -c 'small-caps `ʀ` (`ʀ07`, `(ʀ7)`)' "$root/README.md")" 1
t "talk chats: README uses small-caps ᴢ" "$(grep -c '⚪  ᴢ A6 · Compare libraries' "$root/README.md")" 1
t "talk chats: hub writes small-caps ᴢ" "$(grep -c 'small-caps `ᴢ ` (U+1D22' "$root/skills/hub/SKILL.md")" 1
t "talk chats: old plain Z still counts" "$(grep -c 'old plain$' "$root/skills/hub/SKILL.md")" 1
t "talk chats: Z → ᴢ retitled in one batch" "$(grep -c '(`Z ` → `ᴢ `)' "$root/skills/hub/SKILL.md")" 1
t "talk chats: no plain Z examples left" "$(cat "$root/skills/hub/SKILL.md" "$root/README.md" "$root/docs/all-prompts.md" | grep -cE '⚪  Z |\(`Z `\) sort')" 0
t "talk chats: ᴢ sorts after ʀ" "$(printf '⚪  ᴢ A4\n⚪  ʀ07 A3\n' | LC_ALL=C sort | tail -1 | grep -c 'ᴢ')" 1
t "next release: name in parentheses" "$(grep -c 'its name, the part after the code and ` · `, in parentheses' "$root/skills/hub/SKILL.md")" 1
t "next release: later releases have none" "$(grep -c '`🙋  ʀ25+ F2 · Staging download buttons`' "$root/skills/hub/SKILL.md")" 1
t "next release: talk chats and hub never get them" "$(grep -c 'own title never get them' "$root/skills/hub/SKILL.md")" 1
t "next release: retag to later drops them" "$(grep -c 'Retagging a chat to a later release drops' "$root/skills/hub/SKILL.md")" 1
t "next release: added after a release in the retag batch" "$(grep -c 'put the name in parentheses on every open chat now tagged for the new' "$root/skills/hub/SKILL.md")" 1
t "next release: with or without them is the same chat" "$(grep -c 'A title with or without them is the same' "$root/skills/hub/SKILL.md")" 1
t "next release: README sidebar names in parentheses" "$(grep -cE '^(⚪|🙋|❓|⏳|🚀|🔴|🟢|🔨|✅)  ʀ07 [A-F2-9]{2} · \(.*\)$' "$root/README.md")" 9
t "next release: README later-release chat plain" "$(grep -c '^🔨  ʀ08 E3 · Bulk rename$' "$root/README.md")" 1
t "next release: README code-first keeps both parentheses" "$(grep -c '`🔨  3F · (Fix menu spacing) (ʀ7)`' "$root/README.md")" 1
t "next release: talk chats and hub stay plain" "$(grep -cE '⚪  ᴢ A6 · Compare libraries$|^⚪  Hub · ʀ07 \(6\)$' "$root/README.md")" 2
t "title length: about 40 characters at most" "$(grep -c 'a whole title is about 40 characters at most' "$root/skills/hub/SKILL.md")" 1
t "title length: hub shortens the name" "$(grep -c 'start or retitle a chat, shorten the name to fit' "$root/skills/hub/SKILL.md")" 1
t "title length: README says so" "$(grep -c 'A title is about 40 characters at most' "$root/README.md")" 1
t "title length: CHANGELOG says so" "$(grep -c 'Titles about 40 characters at most' "$root/CHANGELOG.md")" 1
t "title length: README sidebar fits" "$(sed -n '/^## Example sidebar/,/^## Install/p' "$root/README.md" | grep -E '^(⚪|🙋|❓|⏳|🚀|🔴|🟢|🔨|✅)  ' | awk 'length > 40' | wc -l | tr -d ' ')" 0
t "next release: setup mentions it" "$(grep -c 'coming release show their name in parentheses' "$root/skills/setup/SKILL.md")" 1
t "titles: two spaces after the symbol" "$(grep -c "then two spaces (never one)" "$root/skills/hub/SKILL.md")" 1
t "titles: no one-space title examples left" "$(cat "$root/skills/hub/SKILL.md" "$root/skills/setup/SKILL.md" "$root/README.md" | grep -cE '`(⚪|🔨|🙋|⏳|🚀|🟢|🔴|✅|❓) [^ ]')" 0

t "symbols: no rule sends a work chat back to ⚪" "$(cat "$root/skills/hub/SKILL.md" "$root/skills/work-chat/SKILL.md" "$root/README.md" | grep -E '(set|sets|back to|→|no,) ⚪|\(⚪/|⚪/🔨' | grep -vc 'talk chat')" 0
t "symbols: ⚪ means new in the hub" "$(grep -c '`⚪` new: you just started' "$root/skills/hub/SKILL.md")" 1
t "titles: hub sets it when a chat's rename failed" "$(grep -c 'its rename failed' "$root/skills/hub/SKILL.md")" 1
t "titles: work chat swaps only the symbol" "$(grep -c 'swap only that character' "$root/skills/work-chat/SKILL.md")" 1
t "symbols: README legend has 🔨" "$(grep -c '^| 🔨 | Under way' "$root/README.md")" 2
t "symbols: no 🟡 or 🤔 left (now 🙋 and ❓)" "$(cat "$root/skills/hub/SKILL.md" "$root/skills/work-chat/SKILL.md" "$root/skills/setup/SKILL.md" "$root/README.md" "$root/docs/all-prompts.md" "$root"/hooks/*.mjs | grep -E '🟡|🤔' | grep -vc '🟡 → 🙋')" 0
t "symbols: README legend has 🙋 and ❓" "$(grep -cE '^\| (🙋 \| Waiting on your OK|❓ \| Waiting on your answer)' "$root/README.md")" 4
t "symbols: hub's release built is 🙋" "$(grep -c '`🙋` release built, waiting on the owner' "$root/skills/hub/SKILL.md")" 1
t "symbols: work chat names 🙋 and ❓" "$(grep -cE '^  - (🙋|❓) ' "$root/skills/work-chat/SKILL.md")" 2
t "symbols: hub retitles open chats after a symbol rename" "$(grep -c 'retitle every$' "$root/skills/hub/SKILL.md")" 1
t "symbols: rename retitle is one batch" "$(grep -c 'batch of title calls (your own title too)' "$root/skills/hub/SKILL.md")" 1
t "question: plain-text questions set ❓ too" "$(grep -c 'plain text too ("should I add X?"' "$root/skills/work-chat/SKILL.md")" 1
t "titles: set the moment status changes" "$(grep -c 'Set it yourself the moment your status changes' "$root/skills/work-chat/SKILL.md")" 1
t "titles: hub told chats set their own" "$(grep -c '\*\*Chats set their own symbol\*\*' "$root/skills/hub/SKILL.md")" 1
t "question: closing lines aren't questions" "$(grep -c 'a closing "anything else?" isn.t one' "$root/skills/work-chat/SKILL.md")" 1
t "titles: failed rename falls back to a message" "$(grep -c 'If the rename fails, tell the hub the status' "$root/skills/work-chat/SKILL.md")" 1
t "titles: work chat sets 🔨 as it starts work" "$(grep -c 'it": set 🔨 and go straight to work' "$root/skills/work-chat/SKILL.md")" 1
t "titles: hub starts chats with the whole title" "$(grep -c 'Start a chat with its whole title' "$root/skills/hub/SKILL.md")" 1
t "titles: hub told the app's notes show old titles" "$(grep -c 'never updates them' "$root/skills/hub/SKILL.md")" 1
t "titles: README says chats set their own" "$(grep -c 'Each chat sets its own symbol the moment its status changes' "$root/README.md")" 1
# wrapups.mjs: the hub's close backstop. A wrap-up report in a prompt, then a chat still at ⏳.
cd "$tmp"
echo '{"level":1}' > .claude/chat-hub.json
node "$root/hooks/set-hub.mjs" --session hc1 --replace >/dev/null
pd="$tmp/projects"; enc=$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -1 | sed 's/[^a-zA-Z0-9]/-/g')
ct() { mkdir -p "$pd/$enc/$1"; printf '{"customTitle":"%s"}' "$2" > "$pd/$enc/$1/custom-title.json"; }
# Input through a file: a slow writer on a pipe can leave the hook reading nothing.
hp() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],prompt:process.argv[2],cwd:process.argv[3]}))' "$1" "$2" "$(pwd)" > "$tmp/hp.json"; CHAT_HUB_PROJECTS_DIR="$pd" node "$root/hooks/on-prompt.mjs" < "$tmp/hp.json"; }
rm -f .git/chat-hub/wrapups.json
ct w1 '⏳  ʀ32 C7 · Close finished chats'
t "close backstop: quiet with no report" "$(hp hc1 hello | grep -c 'wrap-up report')" 0
t "close backstop: report in the prompt, close now" "$(hp hc1 '**Wrap-up · C7**
- **Commit:** abc' | grep -c 'wrap-up report of C7. Close it now: run close-chat.mjs.*even if its work ships in a later release')" 1
t "close backstop: report remembered" "$(grep -c '"C7"' .git/chat-hub/wrapups.json)" 1
t "close backstop: still ⏳ on the next wake, reminded" "$(hp hc1 hello | grep -c 'close backstop: C7 (\\"⏳  ʀ32 C7 · Close finished chats\\") sent its wrap-up report and still shows ⏳')" 1
t "close backstop: work chats not reminded" "$(hp w9 hello | grep -c 'close backstop')" 0
t "close backstop: hub start note reminds after a clear" "$(echo '{"session_id":"hc1"}' | CHAT_HUB_PROJECTS_DIR="$pd" node "$root/hooks/session-start.mjs" | grep -c 'close backstop: C7')" 1
ct w2 '✅  ʀ28 C7 · An old chat with the same code'
t "close backstop: an old ✅ chat with the code doesn't hide the ⏳ one" "$(hp hc1 hello | grep -c 'close backstop: C7')" 1
ct w1 '✅  ʀ32 C7 · Close finished chats'
t "close backstop: quiet once it's ✅" "$(hp hc1 hello | grep -c 'close backstop')" 0
t "close backstop: forgotten once it's ✅" "$(grep -c '"C7"' .git/chat-hub/wrapups.json)" 0
ct w3 '🔨  ʀ31 E4 · Back at work'
hp hc1 'Wrap-up · E4 (report)' >/dev/null
t "close backstop: back to 🔨 after a failed close, forgotten" "$(hp hc1 hello | grep -c 'close backstop'; grep -c '"E4"' .git/chat-hub/wrapups.json)" "0
0"
hp hc1 '**Wrap-up · F9**' >/dev/null
t "close backstop: no title found, quiet but remembered" "$(hp hc1 hello | grep -c 'close backstop'; grep -c '"F9"' .git/chat-hub/wrapups.json)" "0
1"
t "close backstop: hub rules say no parked state" "$(grep -c 'There is no "parked" state' "$root/skills/hub/SKILL.md")" 1
t "close backstop: hub closes whichever release" "$(grep -c 'never hold a finished chat at ⏳ for a later release' "$root/skills/hub/SKILL.md")" 1
t "close backstop: wrap-up note says a later release too" "$(grep -c 'never leave one at ⏳ for after the clear or a later release' "$root/hooks/usage.mjs")" 1
rm -rf "$pd" .git/chat-hub/wrapups.json
cd "$tmp"
rm -rf "$tmp"; exit $fail
