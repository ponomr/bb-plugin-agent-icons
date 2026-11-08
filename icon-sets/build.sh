#!/usr/bin/env bash
# Rebuild the curated icon sets into <out-dir>/{tabler,lucide,phosphor}.
# Usage: icon-sets/build.sh <out-dir>   (those subfolders must not exist yet)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?usage: build.sh <out-dir>}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# name:npm-spec:folder with 24px icons inside the package
libraries=(
  "tabler:@tabler/icons@3.50.0:icons/outline"
  "lucide:lucide-static@1.70.0:icons"
  "phosphor:@phosphor-icons/core@2.1.1:assets/regular"
)
mkdir -p "$out"
for entry in "${libraries[@]}"; do
  IFS=: read -r name spec folder <<<"$entry"
  mkdir "$work/$name" "$out/$name"
  (cd "$work/$name" && npm pack "$spec" --silent >/dev/null && tar xzf ./*.tgz)
  src="$work/$name/package/$folder"
  # Each line lists alternative names; take the first one the library has and not yet taken.
  grep -v '^#' "$here/concepts.txt" | while read -r alts; do
    [ -n "$alts" ] || continue
    for a in $alts; do
      if [ -f "$src/$a.svg" ] && [ ! -e "$out/$name/$a.svg" ]; then cp "$src/$a.svg" "$out/$name/"; continue 2; fi
    done
    echo "$name: no match for ${alts%% *}"
  done
  echo "$name: $(ls "$out/$name" | wc -l) icons"
done
