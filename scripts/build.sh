#!/usr/bin/env bash
# Build entrypoint for Cloudflare Pages and local production builds.
#
# Responsibilities:
# 1. Ensure Zola is available (auto-download via ZOLA_VERSION if missing)
# 2. Run `zola build` (generates ./public)
# 3. Run post-build generators (e.g. llms.txt)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ensure_zola() {
  if command -v zola >/dev/null 2>&1; then
    return 0
  fi

  local version="${ZOLA_VERSION:-}"
  if [[ -z "$version" && -f "$ROOT_DIR/wrangler.toml" ]]; then
    version="$(
      grep -m1 -E '^\s*ZOLA_VERSION\s*=' "$ROOT_DIR/wrangler.toml" 2>/dev/null \
        | sed -E 's/^\s*ZOLA_VERSION\s*=\s*"([^"]+)"\s*$/\1/' \
        || true
    )"
  fi

  if [[ -z "$version" ]]; then
    echo "error: zola not found on PATH and ZOLA_VERSION is not set" >&2
    echo "hint: set ZOLA_VERSION (e.g. 0.19.2) or install zola in the build environment" >&2
    return 1
  fi

  local os arch target filename url tmpdir
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$arch" in
    x86_64|amd64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
    *)
      echo "error: unsupported architecture: $arch" >&2
      return 1
      ;;
  esac

  case "$os" in
    linux) target="unknown-linux-gnu" ;;
    darwin) target="apple-darwin" ;;
    *)
      echo "error: unsupported OS: $os" >&2
      return 1
      ;;
  esac

  filename="zola-v${version}-${arch}-${target}.tar.gz"
  url="https://github.com/getzola/zola/releases/download/v${version}/${filename}"

  tmpdir="/tmp/zola-${version}-${arch}-${target}"
  mkdir -p "$tmpdir"

  echo "Installing zola v${version} (${arch}-${target})..." >&2
  curl -fsSL "$url" -o "$tmpdir/zola.tar.gz"
  tar -xzf "$tmpdir/zola.tar.gz" -C "$tmpdir"
  chmod +x "$tmpdir/zola"

  export PATH="$tmpdir:$PATH"
}

main() {
  cd "$ROOT_DIR"

  ensure_zola

  echo "Building site with Zola..." >&2
  zola build

  echo "Generating llms.txt outputs..." >&2
  "$SCRIPT_DIR/generate-llms.sh"
}

main "$@"
