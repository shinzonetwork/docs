#!/usr/bin/env bash
# Generates llms.txt and llms-full.txt for docs.shinzo.network.
#
# 1. Run `zola build` to generate the `./public` directory.
# 2. Run this script:
#
#   ```shell
#   ./scripts/generate-llms.sh
#   ```
#
# Output files are written to ./public/ or set OUTPUT_DIR to any other location.
# The page list and order are read automatically from the sidebar tree in
# config.toml ([extra.sidebar]) — the same source of truth the site sidebar
# uses. Add a page to the sidebar there and it appears here; no per-page edits
# are needed. Draft pages (draft = true) are skipped with a warning.
#
# Requires: jq (for glossary rendering).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTENT_DIR="$DOCS_DIR/content"
DATA_DIR="$DOCS_DIR/data"

# Allow overrides for local/dev usage.
OUTPUT_DIR="${OUTPUT_DIR:-$DOCS_DIR/public}"
BASE_URL="${BASE_URL:-https://docs.shinzo.network}"

LLMS_TXT="$OUTPUT_DIR/llms.txt"
LLMS_FULL_TXT="$OUTPUT_DIR/llms-full.txt"

mkdir -p "$OUTPUT_DIR"

# -------
# Helpers
# -------

# Extract a TOML front-matter field. Returns empty string if absent.
get_toml_field() {
    local file="$1" field="$2"
    grep -m1 "^${field}\s*=" "$file" 2>/dev/null \
        | sed -E "s/^${field}\s*=\s*//" \
        | sed -E "s/^(\"(.*)\"|'(.*)')\s*$/\2\3/" \
        || true
}

# Return the markdown body of a file (everything after the closing +++ fence).
get_body() {
    local file="$1"
    awk 'BEGIN{fences=0} /^\+\+\+/{fences++; if(fences==2){found=1; next}} found{print}' "$file"
}

# Strip Zola shortcode tags and co-located image references.
clean_body() {
    sed \
        -e 's/{%[^%]*%}//g' \
        -e 's/{{[^}]*}}//g' \
        -e '/^!\[.*\](\.\/images\/.*)/d'
}

# Collapse runs of consecutive blank lines down to one, and strip leading and
# trailing blank lines. Buffer-based so it works on both BSD (macOS) and GNU awk.
collapse_blanks() {
    awk '
        /^[[:space:]]*$/ { pending++; next }
        {
            if (started) {
                # one blank line between content blocks, never more
                if (pending) print ""
            }
            pending = 0
            started = 1
            print
        }
    '
}

# Derive a site URL path from a content-relative file path.
#   understand/what-is-shinzo/index.md  -> /understand/what-is-shinzo/
#   understand/core-concepts/_index.md  -> /understand/core-concepts/
path_to_url() {
    local rel="$1"
    local dir stem
    dir="$(dirname "$rel")"
    stem="$(basename "${rel%.md}")"
    if [[ "$stem" == "index" || "$stem" == "_index" ]]; then
        printf '/%s/' "$dir"
    else
        printf '/%s/%s/' "$dir" "$stem"
    fi
}

# Map a sidebar section key to its display title.
section_title() {
    case "$1" in
        understand) printf 'Understand' ;;
        build)      printf 'Build apps' ;;
        run)        printf 'Run infrastructure' ;;
        reference)  printf 'Reference' ;;
        *)          printf '%s' "$1" ;;
    esac
}

# ---------------------------------------
# Section header (written to both files).
# ---------------------------------------
section_header() {
    local title="$1"
    printf '\n## %s\n\n' "$title" >> "$LLMS_TXT"
    printf '\n## %s\n\n' "$title" >> "$LLMS_FULL_TXT"
}

# ----------------------------
# Add a standard content page.
# ----------------------------
add_page() {
    local rel_path="$1"
    local content_file="$CONTENT_DIR/$rel_path"

    if [[ ! -f "$content_file" ]]; then
        echo "warning: sidebar page not found, skipping: $rel_path" >&2
        return
    fi

    local draft
    draft="$(get_toml_field "$content_file" "draft")"
    if [[ "$draft" == "true" ]]; then
        echo "warning: skipping draft page listed in sidebar: $rel_path" >&2
        return
    fi

    local title description url
    title="$(get_toml_field "$content_file" "title")"
    description="$(get_toml_field "$content_file" "description")"
    url="${BASE_URL}$(path_to_url "$rel_path")"

    # Index line - written to both files
    if [[ -n "$description" ]]; then
        printf -- '- [%s](%s): %s\n' "$title" "$url" "$description" \
            | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"
    else
        printf -- '- [%s](%s)\n' "$title" "$url" \
            | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"
    fi

    # Full body - written to llms-full.txt only.
    # collapse_blanks also strips leading/trailing blank lines.
    local body
    body="$(get_body "$content_file" | clean_body | collapse_blanks)"

    if [[ -n "$body" ]]; then
        printf '\n### %s\n\n%s\n' "$title" "$body" >> "$LLMS_FULL_TXT"
    fi
}

# ------------------------------------------------------------------------
# Add the glossary page (no markdown body. Content lives in glossary.json)
# ------------------------------------------------------------------------
add_glossary_page() {
    local rel_path="$1"
    local url="${BASE_URL}$(path_to_url "$rel_path")"
    local desc="Definitions for all terms and abbreviations used across the Shinzo documentation."

    printf -- '- [Glossary](%s): %s\n' "$url" "$desc" \
        | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"

    printf '\n### Glossary\n\n' >> "$LLMS_FULL_TXT"

    jq -r '
      .terms[] |
      ("**" + .term + "**" + (if .abbreviation then " (" + .abbreviation + ")" else "" end)),
      (if (.definition // "") != "" then ": " + .definition else empty end),
      (if ((.relatedTerms // []) | length) > 0 then ": *Related: " + (.relatedTerms | join(", ")) + "*" else empty end),
      ""
    ' "$DATA_DIR/glossary.json" >> "$LLMS_FULL_TXT"
}

# ----------------------------------------
# Document header (written to both files).
# ----------------------------------------
write_header() {
    cat >> "$1" << 'EOF'
# Shinzo Developer Portal

> Shinzo is a decentralized indexing network for blockchains. It turns raw
> on-chain data into structured datasets that any application can query,
> without relying on a centralized indexing service.

This documentation covers running Generator and Hosts, building Views with
Viewkit, querying data with the app-sdk, and the full architecture of the
Shinzo network.

- Generator run alongside Ethereum nodes and produce signed, structured data.
- Hosts receive that data over P2P, run WASM transforms (Views), and serve results over GraphQL.
- Developers define Views with Viewkit and query results locally via DefraDB.
- ShinzoHub (Cosmos SDK) handles on-chain coordination: view registration, participant tracking, and access control.
EOF
}

# ----
# Main
# ----

# Start fresh
: > "$LLMS_TXT"
: > "$LLMS_FULL_TXT"

write_header "$LLMS_TXT"
write_header "$LLMS_FULL_TXT"

# Walk the sidebar tree in config.toml and emit each section's pages in order.
# awk extracts one record per [[extra.sidebar]] block:
#   section|path1,path2,...
# The while-loop uses process substitution (< <(...)) so that variables
# (current_section) persist across iterations.
current_section=""
while IFS='|' read -r section paths; do
    if [[ "$section" != "$current_section" ]]; then
        section_header "$(section_title "$section")"
        current_section="$section"
    fi

    IFS=',' read -ra page_paths <<< "$paths"
    for path in "${page_paths[@]}"; do
        if [[ "$path" == "reference/glossary/index.md" ]]; then
            add_glossary_page "$path"
        else
            add_page "$path"
        fi
    done
done < <(
    awk '
        BEGIN { inblock = 0 }
        /^\[\[extra\.sidebar\]\]/ {
            if (inblock && sec != "") {
                printf "%s|", sec
                for (i = 1; i <= n; i++) printf "%s%s", paths[i], (i < n ? "," : "")
                print ""
            }
            sec = ""; n = 0; inblock = 1; next
        }
        inblock && /^section[[:space:]]*=[[:space:]]*"/ {
            sub(/^section[[:space:]]*=[[:space:]]*"/, "")
            sub(/".*/, "")
            sec = $0; next
        }
        inblock {
            line = $0
            while (match(line, /"[^"]*\.md"/)) {
                n++; paths[n] = substr(line, RSTART + 1, RLENGTH - 2)
                line = substr(line, RSTART + RLENGTH)
            }
        }
        END {
            if (inblock && sec != "") {
                printf "%s|", sec
                for (i = 1; i <= n; i++) printf "%s%s", paths[i], (i < n ? "," : "")
                print ""
            }
        }
    ' "$DOCS_DIR/config.toml"
)

echo "Written $(wc -l < "$LLMS_TXT") lines → $LLMS_TXT"
echo "Written $(wc -l < "$LLMS_FULL_TXT") lines → $LLMS_FULL_TXT"
