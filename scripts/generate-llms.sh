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
# Output files are written to ./public/ or set OUTPUT_DIR to any other location. The page order mirrors the sidebar in templates/macros/sidebar.html.

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
        | sed -E "s/^${field}\s*=\s*[\"']?([^\"']*)[\"']?\s*$/\1/" \
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
    local url_path="$1"
    local content_file="$2"
    local override_title="${3:-}"

    local title description url

    if [[ -n "$override_title" ]]; then
        title="$override_title"
    else
        title="$(get_toml_field "$content_file" "title")"
    fi

    description="$(get_toml_field "$content_file" "description")"
    url="${BASE_URL}${url_path}"

    # Index line — written to both files
    if [[ -n "$description" ]]; then
        printf -- '- [%s](%s): %s\n' "$title" "$url" "$description" \
            | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"
    else
        printf -- '- [%s](%s)\n' "$title" "$url" \
            | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"
    fi

    # Full body — written to llms-full.txt only.
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
    local url_path="$1"
    local url="${BASE_URL}${url_path}"
    local desc="Definitions for all terms and abbreviations used across the Shinzo documentation."

    printf -- '- [Glossary](%s): %s\n' "$url" "$desc" \
        | tee -a "$LLMS_TXT" >> "$LLMS_FULL_TXT"

    printf '\n### Glossary\n\n' >> "$LLMS_FULL_TXT"

    python3 - "$DATA_DIR/glossary.json" >> "$LLMS_FULL_TXT" << 'PYEOF'
import json, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

for entry in data.get("terms", []):
    term    = entry.get("term", "")
    abbr    = entry.get("abbreviation", "")
    defn    = entry.get("definition", "")
    related = entry.get("relatedTerms", [])

    header = f"**{term}** ({abbr})" if abbr else f"**{term}**"
    print(header)
    if defn:
        print(f": {defn}")
    if related:
        print(f": *Related: {', '.join(related)}*")
    print()
PYEOF
}

# ----------------------------------------
# Document header (written to both files).
# ----------------------------------------
write_header() {
    cat >> "$1" << 'EOF'
# Shinzō Developer Portal

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

# Introduction
section_header "Introduction"
add_page "/"                             "$CONTENT_DIR/_index.md"                               "What is Shinzo?"
add_page "/introduction/how-it-works/"   "$CONTENT_DIR/introduction/how-it-works/index.md"
add_page "/introduction/core-concepts/"  "$CONTENT_DIR/introduction/core-concepts/index.md"

# Generators
section_header "Generators"
add_page "/generators/overview/"  "$CONTENT_DIR/generators/overview/index.md"
add_page "/generators/install/"   "$CONTENT_DIR/generators/install/index.md"
add_page "/generators/register/"  "$CONTENT_DIR/generators/register/index.md"
add_page "/generators/faq/"       "$CONTENT_DIR/generators/faq/index.md"

# Hosts
section_header "Hosts"
add_page "/hosts/overview/"    "$CONTENT_DIR/hosts/overview/index.md"
add_page "/hosts/quickstart/"  "$CONTENT_DIR/hosts/quickstart/index.md"
add_page "/hosts/examples/"    "$CONTENT_DIR/hosts/examples/index.md"

# Views
section_header "Views"
add_page "/views/overview/"    "$CONTENT_DIR/views/overview/index.md"
add_page "/views/quickstart/"  "$CONTENT_DIR/views/quickstart/index.md"

# Guides
section_header "Guides"
add_page "/guides/building-apps-with-shinzo/"                   "$CONTENT_DIR/guides/building-apps-with-shinzo/index.md"
add_page "/guides/configuring-event-filters-on-a-shinzo-host/"  "$CONTENT_DIR/guides/configuring-event-filters-on-a-shinzo-host/index.md"
add_page "/guides/operator-quickstart/"                         "$CONTENT_DIR/guides/operator-quickstart/index.md"

# Reference
section_header "Reference"
add_page "/reference/architecture-overview/"      "$CONTENT_DIR/reference/architecture-overview/index.md"
add_page "/reference/tools/"                      "$CONTENT_DIR/reference/tools/index.md"
add_page "/reference/components/host-client/"     "$CONTENT_DIR/reference/components/host-client/index.md"
add_page "/reference/components/generator-client/"  "$CONTENT_DIR/reference/components/generator-client/index.md"
add_page "/reference/components/outpost/"         "$CONTENT_DIR/reference/components/outpost/index.md"
add_page "/reference/components/relayer/"         "$CONTENT_DIR/reference/components/relayer/index.md"
add_page "/reference/components/shinzohub/"       "$CONTENT_DIR/reference/components/shinzohub/index.md"
add_page "/reference/components/viewkit/"         "$CONTENT_DIR/reference/components/viewkit/index.md"
add_glossary_page "/reference/glossary/"

# Changelog
section_header "Changelog"
add_page "/changelog/"  "$CONTENT_DIR/changelog/_index.md"

echo "Written $(wc -l < "$LLMS_TXT") lines → $LLMS_TXT"
echo "Written $(wc -l < "$LLMS_FULL_TXT") lines → $LLMS_FULL_TXT"
