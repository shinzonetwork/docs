#!/usr/bin/env bash
# Copies co-located agent instruction sheets (AGENTS.md) into the site output.
#
# A guide can offer AI agents a ready-made instruction sheet: an AGENTS.md file
# placed next to the page's index.md. Zola skips these files entirely
# (ignored_content in config.toml), so this script copies each one into the
# build output at the matching URL path, where the {{ agent_prompt() }}
# shortcode points agents at it:
#
#   content/run/get-started/AGENTS.md  ->  <output>/run/get-started/AGENTS.md
#                                         (https://docs.shinzo.network/run/get-started/AGENTS.md)
#
# Run `zola build` first, then:
#
#   ```shell
#   ./scripts/copy-agents-md.sh
#   ```
#
# The script also fails when a page calls {{ agent_prompt() }} without a
# co-located AGENTS.md, so a callout can never point at a missing file.
# Note: `zola serve` does not run this script, so the curl URL 404s during
# local development; test it against a `zola build` + this script instead.
#
# Output is written to ./public or set OUTPUT_DIR to any other location.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_DIR="$DOCS_DIR/content"

# Allow overrides for local/dev usage.
OUTPUT_DIR="${OUTPUT_DIR:-$DOCS_DIR/public}"

fail=0

cd "$CONTENT_DIR"

# ---------------------------------------------------------
# 1. Every AGENTS.md must belong to a page that uses it, and
#    every agent_prompt() call must have its AGENTS.md.
# ---------------------------------------------------------
while IFS= read -r sheet; do
    page_file="$(dirname "$sheet")/index.md"
    if [[ ! -f "$page_file" ]]; then
        echo "error: $sheet is not colocated with a page's index.md" >&2
        fail=1
        continue
    fi
    if ! grep -qE '\{\{[[:space:]]*agent_prompt\(' "$page_file"; then
        echo "error: $page_file has an AGENTS.md but never calls {{ agent_prompt() }}" >&2
        fail=1
    fi
done < <(find . -name AGENTS.md | sort)

while IFS= read -r page_file; do
    if [[ ! -f "$(dirname "$page_file")/AGENTS.md" ]]; then
        echo "error: $page_file calls agent_prompt() but has no AGENTS.md next to it" >&2
        fail=1
    fi
done < <(grep -rlE '\{\{[[:space:]]*agent_prompt\(' --include='*.md' . || true)

if [[ "$fail" -ne 0 ]]; then
    echo "error: agent instruction sheet checks failed (see above)" >&2
    exit 1
fi

# ---------------------------------------------------------
# 2. Copy each sheet next to the rendered page.
# ---------------------------------------------------------
while IFS= read -r sheet; do
    rel_dir="$(dirname "$sheet")"   # e.g. ./run/get-started
    rel_dir="${rel_dir#./}"
    dest_dir="$OUTPUT_DIR/$rel_dir"
    mkdir -p "$dest_dir"
    cp "$sheet" "$dest_dir/AGENTS.md"
    echo "Copied ${sheet#./} -> $dest_dir/AGENTS.md"
done < <(find . -name AGENTS.md | sort)
