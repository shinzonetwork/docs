#!/usr/bin/env bash
# Check internal links in built Zola site output.
#
# Walks all .html files in the output directory, extracts href attributes from
# <a> tags, and verifies that internal links resolve to existing files. Handles
# Zola's directory-style URL scheme (e.g. /path/ -> path/index.html) and
# verifies fragment anchors (#section) against id attributes in the target page.
#
# Usage: check-links.sh <output-dir> [allowlist]
# Exit: 0 if all links resolve, 1 if broken links are found, 2 on usage error.
#
# The optional allowlist file lists hrefs to suppress (one per line, # comments).
# Use it to keep CI green while known-broken links are being fixed; remove
# entries as they are fixed.

set -euo pipefail

export LC_ALL=C

readonly ANCHOR_RE='<[aA][[:space:]][^>]*href=("[^"]*"|'"'"'[^'"'"']*'"'"')'
readonly ENTITY_RE='&#(x[0-9a-fA-F]+|[0-9]+);'

usage() {
  echo "usage: check-links.sh <output-dir> [allowlist]" >&2
  exit 2
}

# Print $1 with numeric (&#NN; / &#xHH;) and the common named HTML entities
# decoded, mirroring what an HTML parser hands to the link checker.
decode_entities() {
  local s="$1" ent num code oct ch
  while [[ $s =~ $ENTITY_RE ]]; do
    ent="${BASH_REMATCH[0]}"
    num="${BASH_REMATCH[1]}"
    if [[ $num == x* ]]; then
      code=$((16#${num#x}))
    else
      code=$((10#$num))
    fi
    if ((code >= 0x20 && code <= 0x7e)); then
      printf -v oct '%03o' "$code"
      printf -v ch "\\$oct"
      s="${s//"$ent"/$ch}"
    else
      break
    fi
  done
  s="${s//&lt;/<}"
  s="${s//&gt;/>}"
  s="${s//&quot;/\"}"
  s="${s//&apos;/\'}"
  s="${s//&amp;/&}"
  printf '%s' "$s"
}

# True if the file has an id attribute matching the fragment.
fragment_exists() {
  grep -qF "id=\"$2\"" -- "$1" || grep -qF "id='$2'" -- "$1"
}

# Print $1 lexically normalized (resolves ../ segments, like Path.resolve()).
# Falls back to the input as-is when no parent directory exists to cd into.
normalize_path() {
  local p="$1" base out
  while [[ $p == */ && $p != "/" ]]; do p="${p%/}"; done
  out="$(cd "$p" 2>/dev/null && pwd -P)" || out=""
  if [[ -z $out ]]; then
    base="${p##*/}"
    p="${p%/*}"
    if [[ -n $p ]]; then
      out="$(cd "$p" 2>/dev/null && pwd -P)" || out=""
      [[ -n $out ]] && out="$out/$base"
    fi
  fi
  [[ -n $out ]] || out="$1"
  printf '%s\n' "$out"
}

# Set RESOLVED to the file an internal target maps to, or leave it empty.
# Directory-style URLs map to <dir>/index.html; extension-less paths also
# try a sibling .html file.
resolve_target() {
  RESOLVED=""
  if [[ -f $1 ]]; then
    RESOLVED="$1"
  elif [[ -d $1 && -f $1/index.html ]]; then
    RESOLVED="$1/index.html"
  else
    local base="${1##*/}"
    if [[ $base != ?*.* && -f "$1.html" ]]; then
      RESOLVED="$1.html"
    fi
  fi
}

main() {
  if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage
  fi

  OUTPUT_DIR="$(cd "$1" 2>/dev/null && pwd -P)" || {
    echo "error: $1 is not a directory" >&2
    exit 2
  }

  local ALLOW=()
  if [[ $# -eq 2 ]]; then
    if [[ ! -f $2 ]]; then
      echo "error: allowlist file not found: $2" >&2
      exit 2
    fi
    local line
    while IFS= read -r line || [[ -n $line ]]; do
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      [[ -z $line || $line == \#* ]] && continue
      ALLOW+=("$line")
    done < "$2"
  fi

  local BROKEN=()
  local checked=0 skipped=0 files_scanned=0
  local html_file rel_src match line_no href path_part fragment
  local target resolved norm show

  while IFS= read -r html_file; do
    files_scanned=$((files_scanned + 1))
    if [[ ! -r $html_file ]]; then
      echo "warning: could not read $html_file" >&2
      continue
    fi
    rel_src="${html_file#"$OUTPUT_DIR"/}"

    while IFS= read -r match; do
      line_no="${match%%:*}"
      href="${match#*:}"
      href="${href#*href=?}"
      href="${href%?}"
      [[ -n $href ]] || continue
      href="$(decode_entities "$href")"

      case $href in
        http://*|https://*|mailto:*|tel:*|javascript:*|data:*|ftp://*|file:*) continue ;;
      esac

      if [[ ${#ALLOW[@]} -gt 0 ]]; then
        local allowed=0 entry
        for entry in "${ALLOW[@]}"; do
          [[ $entry == "$href" ]] && { allowed=1; break; }
        done
        if [[ $allowed -eq 1 ]]; then
          skipped=$((skipped + 1))
          continue
        fi
      fi

      path_part="${href%%#*}"
      if [[ $href == *"#"* ]]; then fragment="${href#*#}"; else fragment=""; fi

      if [[ -z $path_part ]]; then
        if [[ -n $fragment ]] && ! fragment_exists "$html_file" "$fragment"; then
          BROKEN+=("  $rel_src:$line_no: $href  (missing #$fragment)")
        fi
        continue
      fi

      checked=$((checked + 1))

      if [[ $path_part == /* ]]; then
        while [[ $path_part == /* ]]; do path_part="${path_part#/}"; done
        if [[ -n $path_part ]]; then
          target="$OUTPUT_DIR/$path_part"
        else
          target="$OUTPUT_DIR"
        fi
      else
        target="${html_file%/*}/$path_part"
      fi
      while [[ $target == */ && $target != "/" ]]; do target="${target%/}"; done

      resolve_target "$target"

      if [[ -z $RESOLVED ]]; then
        if [[ $path_part == /* || $href == /* ]]; then
          norm="$target"
        else
          norm="$(normalize_path "$target")"
        fi
        if [[ $norm == "$OUTPUT_DIR" ]]; then
          show="."
        elif [[ $norm == "$OUTPUT_DIR"/* ]]; then
          show="${norm#"$OUTPUT_DIR"/}"
        else
          show="$norm"
        fi
        BROKEN+=("  $rel_src:$line_no: $href  (not found: $show)")
      elif [[ -n $fragment ]] && ! fragment_exists "$RESOLVED" "$fragment"; then
        BROKEN+=("  $rel_src:$line_no: $href  (missing #$fragment)")
      fi
    done < <(grep -noE "$ANCHOR_RE" -- "$html_file" || true)
  done < <(find "$OUTPUT_DIR" -type f -name '*.html' | sort)

  local summary="Checked $checked internal links across $files_scanned HTML files."
  [[ $skipped -gt 0 ]] && summary="$summary Skipped $skipped allowlisted."
  echo "$summary"

  if [[ ${#BROKEN[@]} -gt 0 ]]; then
    echo "" >&2
    echo "Broken link(s) (${#BROKEN[@]}):" >&2
    local entry
    for entry in "${BROKEN[@]}"; do
      echo "$entry" >&2
    done
    exit 1
  fi

  echo "All internal links resolve."
}

main "$@"
