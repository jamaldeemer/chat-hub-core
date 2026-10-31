#!/bin/sh
# Update chat-hub-core everywhere it's installed: the marketplace once, then every project that
# has the plugin (from Claude's installed_plugins.json). Prints each install's old and new version.
# Open chats pick the new version up on their own (hooks/run.mjs); see README "Updating".
# Usage: sh scripts/update-all.sh [--dry-run]
# All of it is one block, read before it runs: the marketplace update can rewrite this file.
{
set -u
plugin=chat-hub-core@chat-hub
file=${CHAT_HUB_PLUGINS_FILE:-$HOME/.claude/plugins/installed_plugins.json}
dry=; [ "${1:-}" = "--dry-run" ] && dry=1
command -v node >/dev/null 2>&1 || { echo "node not found." >&2; exit 1; }
[ -f "$file" ] || { echo "No $file: is Claude Code installed here?" >&2; exit 1; }

# One line per install: scope<TAB>project folder (empty for user scope)<TAB>version
list() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    for (const e of (d.plugins || d)[process.argv[2]] || [])
      console.log([e.scope || "user", e.projectPath || "", e.version || "?"].join("\t"))
  ' "$file" "$plugin"
}
before=$(list) || { echo "Couldn't read $file." >&2; exit 1; }
[ -n "$before" ] || { echo "$plugin isn't installed anywhere."; exit 0; }

run() { echo "+ $*"; [ -n "$dry" ] || "$@"; }
run claude plugin marketplace update chat-hub || { echo "Marketplace update failed; nothing else changed." >&2; exit 1; }

tab=$(printf '\t')
log=$(mktemp "${TMPDIR:-/tmp}/update-all.XXXXXX") || exit 1
echo "$before" | while IFS="$tab" read -r scope dir ver; do
  if [ -n "$dir" ] && [ ! -d "$dir" ]; then echo "skip $dir: folder is gone"; continue; fi
  if [ -n "$dir" ]; then (cd "$dir" && run claude plugin update "$plugin" --scope "$scope") || echo "FAILED in $dir"
  else run claude plugin update "$plugin" --scope "$scope" || echo "FAILED for $scope scope"; fi
done 2>&1 | tee "$log"

echo
after=$(list)
echo "$before" | while IFS="$tab" read -r scope dir ver; do
  new=$(echo "$after" | while IFS="$tab" read -r s d v; do [ "$s" = "$scope" ] && [ "$d" = "$dir" ] && echo "$v"; done | head -1)
  echo "${dir:-($scope)}: $ver -> ${new:-?}"
done
grep -q FAILED "$log"; bad=$?; rm -f "$log"; [ $bad -ne 0 ]
exit
}
