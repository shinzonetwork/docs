#!/usr/bin/env python3
"""Check internal links in built Zola site output.

Walks all .html files in the output directory, extracts href attributes from
<a> tags, and verifies that internal links resolve to existing files. Handles
Zola's directory-style URL scheme (e.g. /path/ -> path/index.html) and
verifies fragment anchors (#section) against id attributes in the target page.

Usage: check-links.py <output-dir> [allowlist]
Exit: 0 if all links resolve, 1 if broken links are found.

The optional allowlist file lists hrefs to suppress (one per line, # comments).
Use it to keep CI green while known-broken links are being fixed; remove
entries as they are fixed.
"""

import sys
from html.parser import HTMLParser
from pathlib import Path


class LinkExtractor(HTMLParser):
    """Collect href values from <a> tags with their source line numbers."""

    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for name, value in attrs:
                if name == "href" and value:
                    self.hrefs.append((value, self.getpos()[0]))


def is_internal(href):
    """True for links that point to pages on this site."""
    return not href.startswith((
        "http://", "https://", "mailto:", "tel:",
        "javascript:", "data:", "ftp://", "file:",
    ))


def resolve_path(href, current_file, output_dir):
    """Resolve an internal href to a (Path, fragment) in the output directory.

    Returns (None, fragment) for pure same-page anchor links.
    """
    path_part, _, fragment = href.partition("#")
    if not path_part:
        return None, fragment

    if path_part.startswith("/"):
        target = output_dir / path_part.lstrip("/")
    else:
        target = (current_file.parent / path_part).resolve()

    return target, fragment


def find_html_file(target):
    """Find the actual file for a resolved target path.

    Zola outputs pages as directory/index.html. Also handles direct files
    (images, etc.) and extension-less paths.
    """
    if target.is_file():
        return target
    if target.is_dir():
        index = target / "index.html"
        if index.is_file():
            return index
    if not target.suffix:
        html_candidate = target.with_suffix(".html")
        if html_candidate.is_file():
            return html_candidate
    return None


def fragment_exists(html_file, fragment):
    """Check that an id matching the fragment exists in the HTML file."""
    if not fragment:
        return True
    try:
        text = html_file.read_text(encoding="utf-8")
    except OSError:
        return True
    return f'id="{fragment}"' in text or f"id='{fragment}'" in text


def load_allowlist(path):
    """Load hrefs to suppress from a file (one per line, # comments)."""
    if not path:
        return set()
    allowed = set()
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            allowed.add(line)
    return allowed


def main():
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("usage: check-links.py <output-dir> [allowlist]", file=sys.stderr)
        return 2

    output_dir = Path(sys.argv[1]).resolve()
    if not output_dir.is_dir():
        print(f"error: {output_dir} is not a directory", file=sys.stderr)
        return 2

    allowlist = load_allowlist(sys.argv[2] if len(sys.argv) > 2 else None)

    broken = []
    skipped = 0
    checked = 0
    files_scanned = 0

    for html_file in sorted(output_dir.rglob("*.html")):
        files_scanned += 1
        extractor = LinkExtractor()
        try:
            extractor.feed(html_file.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"warning: could not parse {html_file}: {exc}", file=sys.stderr)
            continue

        for href, line in extractor.hrefs:
            if not is_internal(href):
                continue

            if href in allowlist:
                skipped += 1
                continue

            target, fragment = resolve_path(href, html_file, output_dir)

            if target is None:
                if fragment and not fragment_exists(html_file, fragment):
                    rel = html_file.relative_to(output_dir)
                    broken.append(f"  {rel}:{line}: {href}  (missing #{fragment})")
                continue

            checked += 1
            resolved = find_html_file(target)

            if resolved is None:
                rel = html_file.relative_to(output_dir)
                try:
                    target_rel = target.relative_to(output_dir)
                except ValueError:
                    target_rel = target
                broken.append(f"  {rel}:{line}: {href}  (not found: {target_rel})")
            elif fragment and not fragment_exists(resolved, fragment):
                rel = html_file.relative_to(output_dir)
                broken.append(f"  {rel}:{line}: {href}  (missing #{fragment})")

    summary = f"Checked {checked} internal links across {files_scanned} HTML files."
    if skipped:
        summary += f" Skipped {skipped} allowlisted."
    print(summary)

    if broken:
        print(f"\nBroken link(s) ({len(broken)}):", file=sys.stderr)
        for entry in broken:
            print(entry, file=sys.stderr)
        return 1

    print("All internal links resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
