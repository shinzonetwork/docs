// Client-side search over Zola's generated Fuse.js index
// (public/search_index.en.json). The Fuse library and the index are fetched
// lazily the first time the search box is used, so pages don't pay for search
// unless it is used.
(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  if (!input || !results) return;

  var INDEX_URL = "/search_index.en.json";
  var FUSE_URL = "/js/fuse.min.mjs";
  var MIN_QUERY = 2;
  var MAX_RESULTS = 10;
  var DEBOUNCE_MS = 150;
  var SNIPPET_CONTEXT = 60;

  var fuse = null;
  var loading = null;
  var debounceTimer = null;
  var rendered = [];
  var selectedIndex = -1;

  function load() {
    if (fuse) return Promise.resolve();
    if (!loading) {
      loading = Promise.all([
        import(FUSE_URL).then(function (m) { return m.default; }),
        fetch(INDEX_URL).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + INDEX_URL);
          return r.json();
        })
      ]).then(function (loaded) {
        var Fuse = loaded[0];
        var docs = loaded[1];
        fuse = new Fuse(docs, {
          keys: [
            { name: "title", weight: 0.4 },
            { name: "description", weight: 0.2 },
            { name: "body", weight: 0.3 },
            { name: "path", weight: 0.1 }
          ],
          threshold: 0.3,
          ignoreLocation: true,
          includeMatches: true,
          minMatchCharLength: MIN_QUERY,
          useExtendedSearch: true
        });
      }).catch(function (err) {
        loading = null; // allow a retry on the next interaction
        throw err;
      });
    }
    return loading;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Text fragment with the given [start, end] (inclusive) ranges wrapped in <mark>.
  function highlight(text, ranges) {
    var frag = document.createDocumentFragment();
    var pos = 0;
    (ranges || []).forEach(function (r) {
      var start = r[0];
      var end = Math.min(r[1] + 1, text.length); // Fuse indices are inclusive
      if (start < pos || start >= text.length) return;
      if (start > pos) frag.appendChild(document.createTextNode(text.slice(pos, start)));
      frag.appendChild(el("mark", "search-result__hl", text.slice(start, end)));
      pos = end;
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  function firstMatch(matches, key) {
    for (var i = 0; i < (matches || []).length; i++) {
      var m = matches[i];
      if (m.key === key && m.indices && m.indices.length) return m;
    }
    return null;
  }

  // Snippet around the first body match with all in-window ranges highlighted,
  // falling back to the description, then a body prefix.
  function snippet(doc, matches) {
    var body = doc.body || "";
    var m = firstMatch(matches, "body");
    if (m) {
      var first = m.indices[0];
      var start = Math.max(0, first[0] - SNIPPET_CONTEXT);
      var end = Math.min(body.length, first[1] + 1 + SNIPPET_CONTEXT);
      var ranges = m.indices
        .filter(function (r) { return r[0] >= start && r[1] < end; })
        .map(function (r) { return [r[0] - start, r[1] - start]; });
      var frag = document.createDocumentFragment();
      if (start > 0) frag.appendChild(document.createTextNode("…"));
      frag.appendChild(highlight(body.slice(start, end), ranges));
      if (end < body.length) frag.appendChild(document.createTextNode("…"));
      return frag;
    }
    if (doc.description) {
      var dm = firstMatch(matches, "description");
      return highlight(doc.description, dm ? dm.indices : null);
    }
    return document.createTextNode(
      body.slice(0, 160) + (body.length > 160 ? "…" : "")
    );
  }

  function buildResult(doc, matches) {
    var link = el("a", "search-result");
    link.href = doc.path || doc.url;
    link.setAttribute("role", "option");
    var title = el("div", "search-result__title");
    var tm = firstMatch(matches, "title");
    title.appendChild(highlight(doc.title || doc.path || doc.url, tm ? tm.indices : null));
    var snip = el("div", "search-result__snippet");
    snip.appendChild(snippet(doc, matches));
    link.appendChild(title);
    link.appendChild(snip);
    return link;
  }

  function setActive(index) {
    selectedIndex = index;
    rendered.forEach(function (link, i) {
      var active = i === index;
      link.classList.toggle("search-result--active", active);
      if (active) {
        link.setAttribute("aria-selected", "true");
        link.scrollIntoView({ block: "nearest" });
      } else {
        link.removeAttribute("aria-selected");
      }
    });
  }

  function clearResults() {
    clearChildren(results);
    rendered = [];
    setActive(-1);
  }

  function setOpen(open) {
    results.classList.toggle("is-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function messageRow(text) {
    var row = el("div", "search-result");
    row.appendChild(el("div", "search-result__snippet", text));
    return row;
  }

  function render(items) {
    clearResults();
    if (!items.length) {
      results.appendChild(messageRow("No results"));
    } else {
      items.slice(0, MAX_RESULTS).forEach(function (item) {
        var link = buildResult(item.item, item.matches);
        results.appendChild(link);
        rendered.push(link);
      });
    }
    setOpen(true);
  }

  // Drop words shorter than MIN_QUERY: Fuse can never match them, so leaving
  // them in would zero out AND queries like "install a host".
  function prepareTerm(term) {
    return term.split(/\s+/).filter(function (w) { return w.length >= MIN_QUERY; }).join(" ");
  }

  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var term = input.value.trim();
    if (term.length < MIN_QUERY) {
      clearResults();
      setOpen(false);
      return;
    }
    debounceTimer = setTimeout(function () {
      load()
        .then(function () {
          if (input.value.trim() !== term) return; // stale query
          var query = prepareTerm(term);
          if (!query) {
            clearResults();
            setOpen(false);
            return;
          }
          render(fuse.search(query));
        })
        .catch(function () {
          if (input.value.trim() !== term) return;
          clearResults();
          results.appendChild(messageRow("Search is unavailable. Try reloading the page."));
          setOpen(true);
        });
    }, DEBOUNCE_MS);
  });

  // Warm the library + index as soon as the search box is focused.
  input.addEventListener("focus", function () {
    load().catch(function () {});
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      clearResults();
      setOpen(false);
      return;
    }
    if (!rendered.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var delta = e.key === "ArrowDown" ? 1 : -1;
      var next = selectedIndex + delta;
      if (next < 0) next = rendered.length - 1;
      if (next >= rendered.length) next = 0;
      setActive(next);
    } else if (e.key === "Enter") {
      var target = rendered[selectedIndex] || rendered[0];
      if (target) {
        e.preventDefault();
        window.location.assign(target.href);
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target !== input && !results.contains(e.target)) {
      clearResults();
      setOpen(false);
    }
  });

  // Minimal combobox semantics for assistive tech.
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "search-results");
  input.setAttribute("aria-autocomplete", "list");
  results.setAttribute("role", "listbox");
})();
