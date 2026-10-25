#!/usr/bin/env bash
# Prints the extension CHANGELOG section for one version, and fails when the section is missing or empty.
# Usage: .github/scripts/changelog-section.sh <version>
set -euo pipefail

version="${1:?version is required}"
changelog="apps/browser-extension/CHANGELOG.md"

section="$(awk -v heading="## $version" '
  $0 == heading { found = 1; next }
  found && /^## / { exit }
  found { print }
' "$changelog")"

if [[ -z "$(tr -d '[:space:]' <<< "$section")" ]]; then
  echo "::error title=Missing changelog entry::$changelog has no section for $version." >&2
  exit 1
fi

printf '%s\n' "$section"
