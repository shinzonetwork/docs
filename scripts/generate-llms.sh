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

# Understand
section_header "Understand"
add_page "/understand/what-is-shinzo/"        "$CONTENT_DIR/understand/what-is-shinzo/index.md"
add_page "/understand/how-it-works/"          "$CONTENT_DIR/understand/how-it-works/index.md"
add_page "/understand/eli5-architecture/"     "$CONTENT_DIR/understand/eli5-architecture/index.md"
add_page "/understand/core-concepts/"                   "$CONTENT_DIR/understand/core-concepts/_index.md"
add_page "/understand/core-concepts/views/"             "$CONTENT_DIR/understand/core-concepts/views/index.md"
add_page "/understand/core-concepts/attestation/"       "$CONTENT_DIR/understand/core-concepts/attestation/index.md"
add_page "/understand/core-concepts/defradb/"           "$CONTENT_DIR/understand/core-concepts/defradb/index.md"
add_page "/understand/core-concepts/shnz-token/"        "$CONTENT_DIR/understand/core-concepts/shnz-token/index.md"

# Build apps
section_header "Build apps"
add_page "/build/your-first-app/"   "$CONTENT_DIR/build/your-first-app/index.md"
add_page "/build/create-a-view/"    "$CONTENT_DIR/build/create-a-view/index.md"
add_page "/build/build-an-app/"     "$CONTENT_DIR/build/build-an-app/index.md"
add_page "/build/query-data/"       "$CONTENT_DIR/build/query-data/index.md"
add_page "/build/publish-and-earn/" "$CONTENT_DIR/build/publish-and-earn/index.md"
add_page "/build/concepts/"                       "$CONTENT_DIR/build/concepts/_index.md"
add_page "/build/concepts/views-for-builders/"            "$CONTENT_DIR/build/concepts/views-for-builders/index.md"
add_page "/build/concepts/economics-of-views/"            "$CONTENT_DIR/build/concepts/economics-of-views/index.md"
add_page "/build/concepts/attestation-as-a-query-filter/" "$CONTENT_DIR/build/concepts/attestation-as-a-query-filter/index.md"

# Run infrastructure
section_header "Run infrastructure"
add_page "/run/get-started/"  "$CONTENT_DIR/run/get-started/index.md"
add_page "/run/run-a-generator/"                       "$CONTENT_DIR/run/run-a-generator/_index.md"
add_page "/run/run-a-generator/install/"               "$CONTENT_DIR/run/run-a-generator/install/index.md"
add_page "/run/run-a-generator/hardware-requirements/" "$CONTENT_DIR/run/run-a-generator/hardware-requirements/index.md"
add_page "/run/run-a-generator/register/"              "$CONTENT_DIR/run/run-a-generator/register/index.md"
add_page "/run/run-a-host/"                       "$CONTENT_DIR/run/run-a-host/_index.md"
add_page "/run/run-a-host/install/"               "$CONTENT_DIR/run/run-a-host/install/index.md"
add_page "/run/run-a-host/hardware-requirements/" "$CONTENT_DIR/run/run-a-host/hardware-requirements/index.md"
add_page "/run/run-a-host/configure-event-filters/" "$CONTENT_DIR/run/run-a-host/configure-event-filters/index.md"
add_page "/run/run-a-host/register/"              "$CONTENT_DIR/run/run-a-host/register/index.md"
add_page "/run/run-a-host/quickstart/"            "$CONTENT_DIR/run/run-a-host/quickstart/index.md"
add_page "/run/operations/"                          "$CONTENT_DIR/run/operations/_index.md"
add_page "/run/operations/key-and-identity-management/" "$CONTENT_DIR/run/operations/key-and-identity-management/index.md"
add_page "/run/operations/backups/"                "$CONTENT_DIR/run/operations/backups/index.md"
add_page "/run/operations/monitoring/"             "$CONTENT_DIR/run/operations/monitoring/index.md"
add_page "/run/operations/troubleshooting/"        "$CONTENT_DIR/run/operations/troubleshooting/index.md"
add_page "/run/private-hosts/"  "$CONTENT_DIR/run/private-hosts/index.md"
add_page "/run/earnings/"       "$CONTENT_DIR/run/earnings/index.md"

# Reference
section_header "Reference"
add_page "/reference/architecture/"  "$CONTENT_DIR/reference/architecture/index.md"
add_page "/reference/changelog/"     "$CONTENT_DIR/reference/changelog/index.md"
add_page "/reference/tools/"         "$CONTENT_DIR/reference/tools/index.md"
add_glossary_page "/reference/glossary/"
add_page "/reference/components/generator-client/" "$CONTENT_DIR/reference/components/generator-client/index.md"
add_page "/reference/components/host-client/"      "$CONTENT_DIR/reference/components/host-client/index.md"
add_page "/reference/components/shinzohub/"        "$CONTENT_DIR/reference/components/shinzohub/index.md"
add_page "/reference/components/sourcehub/"        "$CONTENT_DIR/reference/components/sourcehub/index.md"
add_page "/reference/components/outpost/"          "$CONTENT_DIR/reference/components/outpost/index.md"
add_page "/reference/components/viewkit/"          "$CONTENT_DIR/reference/components/viewkit/index.md"
add_page "/reference/components/defradb/"          "$CONTENT_DIR/reference/components/defradb/index.md"
add_page "/reference/components/lens/"             "$CONTENT_DIR/reference/components/lens/index.md"
add_page "/reference/components/relayer/"          "$CONTENT_DIR/reference/components/relayer/index.md"
add_page "/reference/data-model/"                   "$CONTENT_DIR/reference/data-model/_index.md"
add_page "/reference/data-model/primitives/"        "$CONTENT_DIR/reference/data-model/primitives/index.md"
add_page "/reference/data-model/signatures/"        "$CONTENT_DIR/reference/data-model/signatures/index.md"
add_page "/reference/data-model/attestation-record/" "$CONTENT_DIR/reference/data-model/attestation-record/index.md"
add_page "/reference/data-model/naming-convention/" "$CONTENT_DIR/reference/data-model/naming-convention/index.md"
add_page "/reference/data-model/defradb-metadata/"  "$CONTENT_DIR/reference/data-model/defradb-metadata/index.md"
add_page "/reference/data-model/schema-directives/" "$CONTENT_DIR/reference/data-model/schema-directives/index.md"
add_page "/reference/graphql-api/"     "$CONTENT_DIR/reference/graphql-api/index.md"
add_page "/reference/specs-and-limits/" "$CONTENT_DIR/reference/specs-and-limits/index.md"

echo "Written $(wc -l < "$LLMS_TXT") lines → $LLMS_TXT"
echo "Written $(wc -l < "$LLMS_FULL_TXT") lines → $LLMS_FULL_TXT"
