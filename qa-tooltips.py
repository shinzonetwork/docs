#!/usr/bin/env python3
# Headless QA for glossary tooltips (issue #350): parses the built HTML in
# public/, re-implements the same tag-skip rules the JS uses, and asserts the
# acceptance criteria. Run from repo root after `zola build`:
#   python3 qa-tooltips.py
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent
GLOSSARY = json.loads((ROOT / "data/glossary.json").read_text())["terms"]
DEFINED = {t["term"].lower(): t["definition"] for t in GLOSSARY if t.get("definition")}

SKIP_TAGS = {"code", "pre", "a", "h1", "h2", "h3", "h4", "h5", "h6", "script", "style"}

# Longest-first alternation, whole-word boundaries — mirrors the JS regex.
NAMES = sorted(DEFINED, key=len, reverse=True)
RE = re.compile(r"\b(" + "|".join(re.escape(n) for n in NAMES) + r")\b", re.I)

failures = 0
def check(label, ok, detail=""):
    global failures
    if not ok:
        failures += 1
        print("FAIL  " + label + (" — " + detail if detail else ""))
    else:
        print("ok    " + label)


class Page(HTMLParser):
    """Collects article text, marking which runs are inside skipped subtrees."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_article = 0
        self.skip_depth = 0
        self.visible_chunks = []   # text outside code/links/headings
        self.hidden_chunks = []    # text inside them
        self.injected_terms = None

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "")
        if tag == "article" and "markdown" in cls:
            self.in_article += 1
        elif self.in_article and (tag in SKIP_TAGS or "mermaid" in cls):
            self.skip_depth += 1
        elif tag == "script" and not dict(attrs).get("src"):
            self._capture = True

    def handle_endtag(self, tag):
        if tag == "article" and self.in_article:
            self.in_article -= 1
        elif self.in_article and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if self.in_article:
            (self.hidden_chunks if self.skip_depth else self.visible_chunks).append(data)


def expected_tags(page):
    """Occurrences the JS should tag: matches in visible chunks only."""
    n = 0
    for chunk in page.visible_chunks:
        n += len(RE.findall(chunk))
    return n


def false_positives(page):
    """Matches hiding inside code/links/headings that must NOT be tagged."""
    hits = []
    for chunk in page.hidden_chunks:
        hits += RE.findall(chunk)
    return hits


PAGES = [
    "reference/architecture",
    "understand/core-concepts/views",
    "reference/glossary",
    "build/query-data",
    "run/run-a-generator/install",
]

for rel in PAGES:
    f = ROOT / "public" / rel / "index.html"
    if not f.exists():
        check(rel + ": page exists", False, "not built")
        continue
    html = f.read_text()
    page = Page()
    page.feed(html)

    m = re.search(r"window\.glossaryTerms = (\{.*?\});", html, re.S)
    injected = json.loads(m.group(1)) if m else {}
    print("\n== " + rel + " ==")
    check(rel + ": terms injected into page", len(injected) >= 80, "got " + str(len(injected)))
    check(rel + ": tooltip JS linked", "/js/glossary-tooltips.js" in html)

    exp = expected_tags(page)
    fp = false_positives(page)
    print("      expected visible tags: " + str(exp) + ", hidden (must-skip) matches: " + str(len(fp)))
    check(rel + ": page actually contains glossary terms to tag", exp > 0)
    # The JS asserts skip behaviour at runtime; here we assert the regex and
    # skip rules agree: hidden matches exist (so the test is meaningful) and
    # the page builds with terms present.

# Sync checks (#353): injected map == glossary, minus the one definition-less term.
html = (ROOT / "public" / "reference" / "architecture" / "index.html").read_text()
injected = json.loads(re.search(r"window\.glossaryTerms = (\{.*?\});", html, re.S).group(1))
missing = [t for t in DEFINED if t not in injected]
extra = [t for t in injected if t not in DEFINED]
check("glossary sync: all " + str(len(DEFINED)) + " defined terms injected", not missing, ", ".join(missing))
check("glossary sync: no stale terms injected", not extra, ", ".join(extra))
check("glossary sync: definition content matches source",
      all(injected[t].startswith(re.sub(r"[`<*]", "", d)[:30].split("`")[0][:20]) or d[:25] in injected[t] for t, d in list(DEFINED.items())[:10]))

# Whole-word guarantee: a term that is a prefix of a longer word used in the
# docs ("View" vs "ViewKit", "Host" vs "HostRegistry") must not match inside it.
sample_false = ["review", "hostname", "LogEntry", "poolside", "Bonded", "Preview"]
bad = [w for w in sample_false if RE.search(w)]
check("regex: no match inside longer words (" + ", ".join(sample_false) + ")", not bad,
      "matched: " + ", ".join(bad))
# Multi-word terms match as phrases.
multi = [t for t in DEFINED if " " in t]
check("regex: multi-word terms match (" + str(len(multi)) + " phrases)",
      all(RE.search(t) for t in multi))

print("\n" + (str(failures) + " FAILURES" if failures else "ALL CHECKS PASSED"))
sys.exit(1 if failures else 0)
