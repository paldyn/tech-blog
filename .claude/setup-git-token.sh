#!/bin/bash
# Configure git push to use $GITHUB_TOKEN for github.com.
# Triggered by the SessionStart hook in .claude/settings.json.

set -e

[ -n "${GITHUB_TOKEN:-}" ] || exit 0

repo_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -d "$repo_dir/.git" ] || exit 0

cd "$repo_dir"

git remote set-url origin https://github.com/paldyn/tech-blog.git

git config 'credential.https://github.com.helper' '!f() { echo username=x-access-token; echo "password=${GITHUB_TOKEN}"; }; f'
