// Docs search: natural-language search and answers against a Cloudflare AI
// Search public endpoint, with the local Fuse.js keyword index as a fallback.
//
// Two query paths share the navbar search box (templates/base.html):
//   - Typing POSTs {endpoint}/search (hybrid semantic + keyword retrieval) and
//     renders ranked pages: chunks are deduped per page, best chunk wins.
//   - "Ask the docs" (the action row, or Enter with the panel closed) POSTs
//     {endpoint}/chat/completions with stream: true. The SSE `chunks` event
//     arrives first and renders the source citations, then the answer streams
//     in and is rendered with a small, safe markdown subset.
//
// The endpoint URL comes from config.toml (extra.ai_search_endpoint), rendered
// onto .search-box as data-ai-search-endpoint. When it is unset, unreachable,
// or returns nothing, search falls back to the previous behaviour: keyword
// search over Zola's generated search_index.en.json, fetched lazily. So pages
// don't pay for search unless it is used, and search keeps working during
// Cloudflare outages and local development.
//
// Wire format: Cloudflare AI Search public endpoint
// https://developers.cloudflare.com/ai-search/api/search/public-endpoint/
(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  var statusEl = document.getElementById("search-status");
  if (!input || !results) return;

  var box = document.querySelector(".search-box");
  var ENDPOINT = ((box && box.getAttribute("data-ai-search-endpoint")) || "")
    .trim()
    .replace(/\/+$/, "");
  // Production origin (config.base_url). Used to rewrite crawled result URLs
  // into site paths so result links also work on localhost and previews.
  var SITE_ORIGIN = (function () {
    var base = (box && box.getAttribute("data-site-origin")) || "";
    try {
      return new URL(base).origin;
    } catch (e) {
      return "";
    }
  })();

  var FUSE_URL = "/js/fuse.min.mjs";
  var INDEX_URL = "/search_index.en.json";
  var MIN_QUERY = 2;
  var MAX_PAGES = 8; // rows rendered in the panel
  var FETCH_PAGES = 20; // chunks requested from /search, deduped down
  var ASK_SOURCES = 5; // context chunks requested for an answer
  var AI_DEBOUNCE_MS = 350; // server round-trip per keystroke
  var KEYWORD_DEBOUNCE_MS = 150; // local index, unchanged from the old search
  var SNIPPET_CHARS = 200;

  var fuse = null;
  var fuseLoading = null;
  var aiAbort = null; // AbortController for the in-flight /search
  var askAbort = null; // AbortController for the in-flight /chat/completions
  var askInflight = false;
  var debounceTimer = null;
  var rendered = []; // focusable rows: result links + the ask row
  var selectedIndex = -1;
  var lastQuery = "";
  var lastResults = [];

  /* ---- tiny DOM helpers ---------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Screen-reader status line for the current search state.
  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  /* ---- text helpers --------------------------------------------------- */

  // Entities that show up in crawled <title> metadata.
  function decodeEntities(text) {
    return String(text || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Crawled chunks carry markdown; keep snippets readable by reducing the
  // commonest markup back to plain text.
  function plainText(text) {
    return String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#*_`>]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function trimSnippet(text, max) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var space = cut.lastIndexOf(" ");
    return (space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
  }

  // Fallback title from the last meaningful path segment when crawled
  // metadata carries no title:
  // /run/run-a-host/configure-event-filters/ -> "Configure event filters".
  function titleFromPath(pathname) {
    try {
      var parts = pathname.replace(/\/+$/, "").split("/");
      var last = parts[parts.length - 1] || parts[parts.length - 2] || "Docs";
      var words = decodeURIComponent(last).replace(/[-_]+/g, " ").trim();
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Docs";
    } catch (e) {
      return "Docs";
    }
  }

  /* ---- URL mapping ----------------------------------------------------- */

  // Map a crawled URL (chunk.item.key) to an in-site path when it belongs to
  // this site, else keep the absolute URL; null when unusable. Only http(s)
  // survives, so nothing hostile can ever become a link.
  function resultHref(key) {
    if (!key || typeof key !== "string") return null;
    try {
      var u = new URL(key, SITE_ORIGIN || window.location.origin);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      if (!SITE_ORIGIN || u.origin === SITE_ORIGIN) return u.pathname + u.search;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  // Breadcrumb-ish hint under a result: /run/run-a-host/install/ ->
  // "run / run-a-host / install".
  function pathHint(href) {
    try {
      var path = href.charAt(0) === "/" ? href : new URL(href).pathname;
      var parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
      return parts.join(" / ");
    } catch (e) {
      return "";
    }
  }

  /* ---- AI Search backend ---------------------------------------------- */

  // Collapse chunks into one entry per page, best chunk first: the highest
  // scoring chunk of a page provides the snippet, later ones are dropped.
  function groupPages(chunks) {
    var pages = [];
    var byKey = Object.create(null);
    (chunks || []).forEach(function (chunk) {
      var item = (chunk && chunk.item) || {};
      var href = resultHref(item.key);
      if (!href) return;
      var meta = item.metadata || {};
      var page = byKey[item.key];
      if (!page) {
        page = byKey[item.key] = {
          href: href,
          title: decodeEntities(meta.title) || titleFromPath(href),
          snippet: plainText(chunk.text) || plainText(meta.description),
          score: chunk.score || 0
        };
        pages.push(page);
      } else if ((chunk.score || 0) > page.score) {
        page.score = chunk.score || 0;
        if (plainText(chunk.text)) page.snippet = plainText(chunk.text);
      }
    });
    return pages;
  }

  async function aiSearch(query, signal) {
    var response = await fetch(ENDPOINT + "/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "cf-ai-search-source": "docs-search"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        stream: false,
        ai_search_options: { retrieval: { max_num_results: FETCH_PAGES } }
      }),
      signal: signal
    });
    if (!response.ok) throw new Error("HTTP " + response.status + " from /search");
    var data = await response.json();
    if (!data || data.success === false) throw new Error("AI search error response");
    var chunks = (data.result && data.result.chunks) || data.chunks || [];
    return groupPages(chunks);
  }

  // One SSE block (between blank lines) -> { event, data } or null when the
  // block carries no data field. Tolerates CRLF and comment lines.
  function parseSseBlock(block) {
    var event = "message";
    var dataLines = [];
    var lines = String(block).split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      if (!line || line.charAt(0) === ":") continue;
      var colon = line.indexOf(":");
      var field = colon === -1 ? line : line.slice(0, colon);
      var value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.charAt(0) === " ") value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (!dataLines.length) return null;
    return { event: event, data: dataLines.join("\n") };
  }

  function isAbortError(err) {
    return !!err && (err.name === "AbortError" || /abort/i.test(String(err.message || "")));
  }

  // Ask the docs: POST /chat/completions with stream: true and consume the SSE
  // stream. handlers.onSources fires when the `chunks` event arrives (before
  // the answer), handlers.onToken once per content delta.
  async function askDocs(query, handlers, signal) {
    var response = await fetch(ENDPOINT + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "cf-ai-search-source": "docs-search"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        stream: true,
        ai_search_options: { retrieval: { max_num_results: ASK_SOURCES } }
      }),
      signal: signal
    });
    if (!response.ok) throw new Error("HTTP " + response.status + " from /chat/completions");
    if (!response.body) throw new Error("Empty /chat/completions body");

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function consumeBlock(block) {
      var parsed = parseSseBlock(block);
      if (!parsed) return;
      if (parsed.event === "chunks") {
        // Source citations for the answer, sent before the first token.
        try {
          handlers.onSources(groupPages(JSON.parse(parsed.data)));
        } catch (e) {
          /* tolerate a malformed frame */
        }
        return;
      }
      if (parsed.data === "[DONE]") return;
      try {
        var payload = JSON.parse(parsed.data);
        var delta = payload && payload.choices && payload.choices[0] && payload.choices[0].delta;
        if (delta && typeof delta.content === "string" && delta.content) {
          handlers.onToken(delta.content);
        }
      } catch (e) {
        /* tolerate a malformed frame */
      }
    }

    try {
      while (true) {
        var r = await reader.read();
        if (r.value) buffer += decoder.decode(r.value, { stream: true });
        var idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          var block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          consumeBlock(block);
        }
        if (r.done) {
          buffer += decoder.decode();
          if (buffer.trim()) consumeBlock(buffer);
          return;
        }
      }
    } catch (err) {
      if (isAbortError(err)) return;
      throw err;
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        /* already released */
      }
    }
  }

  /* ---- safe markdown for the streamed answer ---------------------------
     Everything is built with createElement/textContent — model output can
     never inject HTML. Supports the subset answers actually use: paragraphs,
     headings, lists, fenced code, inline code, bold, italic, links. ------- */

  var INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

  function renderInlineInto(node, text) {
    var str = String(text || "");
    var pos = 0;
    var m;
    INLINE_RE.lastIndex = 0;
    while ((m = INLINE_RE.exec(str)) !== null) {
      if (m.index > pos) node.appendChild(document.createTextNode(str.slice(pos, m.index)));
      var tok = m[0];
      if (tok.charAt(0) === "`") {
        node.appendChild(el("code", "search-answer__code", tok.slice(1, -1)));
      } else if (tok.charAt(0) === "*") {
        var strong = tok.charAt(1) === "*";
        var inner = tok.slice(strong ? 2 : 1, strong ? -2 : -1);
        node.appendChild(el(strong ? "strong" : "em", null, inner));
      } else {
        var linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        // The regex constrains hrefs to http(s) or site-relative; resultHref
        // additionally rewrites same-site URLs to in-site paths and rejects
        // anything hostile. Unusable hrefs render as plain text.
        if (linkMatch) {
          var href = resultHref(linkMatch[2]);
          if (href) {
            var a = el("a", "search-answer__link", linkMatch[1]);
            a.href = href;
            node.appendChild(a);
          } else {
            node.appendChild(document.createTextNode(tok));
          }
        }
      }
      pos = m.index + tok.length;
    }
    if (pos < str.length) node.appendChild(document.createTextNode(str.slice(pos)));
  }

  function renderMarkdown(container, text) {
    clearChildren(container);
    var lines = String(text || "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    var paraLines = [];
    var list = null; // { tag: "ul"|"ol", items: [[line, ...]] }

    function flushPara() {
      if (!paraLines.length) return;
      var p = el("p", "search-answer__p");
      renderInlineInto(p, paraLines.join(" "));
      container.appendChild(p);
      paraLines = [];
    }

    function flushList() {
      if (!list) return;
      var ul = el(list.tag, "search-answer__list");
      list.items.forEach(function (itemLines) {
        var li = el("li", null);
        renderInlineInto(li, itemLines.join(" "));
        ul.appendChild(li);
      });
      container.appendChild(ul);
      list = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Fenced code block.
      if (/^\s*```/.test(line)) {
        flushPara();
        flushList();
        var codeLines = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        var pre = el("pre", "search-answer__pre");
        pre.appendChild(el("code", null, codeLines.join("\n")));
        container.appendChild(pre);
        continue;
      }

      var heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) {
        flushPara();
        flushList();
        container.appendChild(el("div", "search-answer__heading", heading[1]));
        continue;
      }

      var bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      var ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || ordered) {
        flushPara();
        var tag = ordered ? "ol" : "ul";
        if (!list || list.tag !== tag) {
          flushList();
          list = { tag: tag, items: [] };
        }
        list.items.push([(bullet || ordered)[1]]);
        continue;
      }

      if (!line.trim()) {
        flushPara();
        flushList();
        continue;
      }

      // Anything else (blockquotes included) joins the current paragraph.
      paraLines.push(line.replace(/^\s*>\s?/, ""));
    }
    flushPara();
    flushList();
  }

  /* ---- panel management ------------------------------------------------ */

  function setOpen(open) {
    results.classList.toggle("is-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) abortAll();
  }

  function clearResults() {
    clearChildren(results);
    rendered = [];
    selectedIndex = -1;
    results.classList.remove("is-answer");
  }

  function messageRow(text, extraClass) {
    var row = el("div", "search-result" + (extraClass ? " " + extraClass : ""));
    row.appendChild(el("div", "search-result__snippet", text));
    return row;
  }

  function noteRow(text) {
    return el("div", "search-results__note", text);
  }

  function setActive(index) {
    selectedIndex = index;
    rendered.forEach(function (row, i) {
      var active = i === index;
      row.classList.toggle("search-result--active", active);
      if (active) {
        row.setAttribute("aria-selected", "true");
        row.scrollIntoView({ block: "nearest" });
      } else {
        row.removeAttribute("aria-selected");
      }
    });
  }

  /* ---- rendering: AI results ------------------------------------------ */

  function buildAiResult(page) {
    var link = el("a", "search-result");
    link.href = page.href;
    link.setAttribute("role", "option");
    link.appendChild(el("div", "search-result__title", page.title));
    if (page.snippet) {
      link.appendChild(el("div", "search-result__snippet", trimSnippet(page.snippet, SNIPPET_CHARS)));
    }
    var hint = pathHint(page.href);
    if (hint) link.appendChild(el("div", "search-result__url", hint));
    return link;
  }

  function buildAskRow() {
    var row = el("button", "search-result search-result--ask");
    row.type = "button";
    row.setAttribute("role", "option");
    var title = el("div", "search-result__title");
    title.appendChild(el("span", "search-result__spark", "✦"));
    title.appendChild(document.createTextNode(" Ask the docs"));
    title.appendChild(el("span", "search-result__enter", "↵"));
    row.appendChild(title);
    row.appendChild(el("div", "search-result__snippet", "Get an AI answer with cited sources"));
    row.addEventListener("click", function () {
      startAsk(input.value.trim());
    });
    return row;
  }

  function renderAiResults(pages, term) {
    clearResults();
    lastQuery = term;
    lastResults = pages;
    setStatus(pages.length + (pages.length === 1 ? " page" : " pages") + " found");
    pages.slice(0, MAX_PAGES).forEach(function (page) {
      var link = buildAiResult(page);
      results.appendChild(link);
      rendered.push(link);
    });
    var ask = buildAskRow();
    results.appendChild(ask);
    rendered.push(ask);
    setActive(-1);
    setOpen(true);
  }

  function runSearch(term) {
    if (!ENDPOINT) {
      renderKeywordResults(term, null);
      return;
    }
    if (aiAbort) aiAbort.abort();
    var controller = (aiAbort = new AbortController());
    clearResults();
    results.appendChild(messageRow("Searching…", "search-result--loading"));
    setOpen(true);
    setStatus("Searching");

    aiSearch(term, controller.signal)
      .then(function (pages) {
        if (controller.signal.aborted || input.value.trim() !== term) return;
        if (aiAbort === controller) aiAbort = null;
        if (!pages.length) {
          // Semantic layer found nothing; try the local keyword index before
          // showing an empty panel.
          renderKeywordResults(term, "No AI matches — keyword results");
          return;
        }
        renderAiResults(pages, term);
      })
      .catch(function (err) {
        if (isAbortError(err)) return;
        if (controller.signal.aborted || input.value.trim() !== term) return;
        renderKeywordResults(term, "AI search unavailable — keyword results");
      });
  }

  /* ---- rendering: Ask-the-docs answer ---------------------------------- */

  // Keep the panel pinned near the bottom while the answer streams in, unless
  // the user has scrolled up to read.
  function pinAnswer() {
    var nearBottom = results.scrollHeight - results.scrollTop - results.clientHeight < 60;
    if (nearBottom) results.scrollTop = results.scrollHeight;
  }

  function startAsk(query) {
    if (!ENDPOINT || !query || askInflight) return;
    abortAll(); // stop any in-flight search so it cannot overwrite the answer
    var controller = (askAbort = new AbortController());
    askInflight = true;
    clearResults();
    results.classList.add("is-answer");
    setOpen(true);
    setStatus("Asking the docs");

    var view = el("div", "search-answer");
    var back = el("button", "search-answer__back", "← Back to results");
    back.type = "button";
    back.addEventListener("click", function () {
      abortAsk();
      renderResultsView();
    });
    var statusRow = el("div", "search-answer__status", "Reading the docs…");
    var body = el("div", "search-answer__body");
    var sources = el("div", "search-answer__sources");
    view.appendChild(back);
    view.appendChild(statusRow);
    view.appendChild(body);
    view.appendChild(sources);
    results.appendChild(view);

    var gotToken = false;
    var answer = "";

    askDocs(
      query,
      {
        onSources: function (pages) {
          if (!pages.length || controller.signal.aborted) return;
          sources.appendChild(el("div", "search-answer__sources-label", "Sources"));
          var list = el("ol", "search-answer__sources-list");
          pages.slice(0, ASK_SOURCES).forEach(function (page) {
            var li = el("li", null);
            var a = el("a", null, page.title);
            a.href = page.href;
            li.appendChild(a);
            list.appendChild(li);
          });
          sources.appendChild(list);
        },
        onToken: function (token) {
          if (controller.signal.aborted) return;
          if (!gotToken) {
            gotToken = true;
            statusRow.remove();
          }
          answer += token;
          renderMarkdown(body, answer);
          pinAnswer();
        }
      },
      controller.signal
    )
      .then(function () {
        if (controller.signal.aborted) return;
        askInflight = false;
        if (askAbort === controller) askAbort = null;
        if (!gotToken) {
          statusRow.textContent = "No answer came back — search instead.";
        } else {
          setStatus("AI answer ready");
        }
      })
      .catch(function (err) {
        if (isAbortError(err)) return;
        if (controller.signal.aborted) return;
        askInflight = false;
        if (askAbort === controller) askAbort = null;
        // Put the result list back rather than leaving a dead panel.
        if (lastResults.length && input.value.trim() === lastQuery) {
          renderResultsView();
          results.insertBefore(noteRow("AI answer unavailable"), results.firstChild);
        } else if (input.value.trim()) {
          renderKeywordResults(input.value.trim(), "AI answer unavailable — keyword results");
        }
      });
  }

  // Restore the last result list (e.g. "Back to results" from an answer).
  function renderResultsView() {
    var term = input.value.trim();
    if (lastResults.length && term && term === lastQuery) {
      renderAiResults(lastResults, term);
    } else if (term) {
      runSearch(term);
    } else {
      clearResults();
      setOpen(false);
    }
  }

  /* ---- rendering: keyword fallback (previous search) ------------------- */

  function loadFuse() {
    if (fuse) return Promise.resolve();
    if (!fuseLoading) {
      fuseLoading = Promise.all([
        import(FUSE_URL).then(function (m) {
          return m.default;
        }),
        fetch(INDEX_URL).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status + " fetching " + INDEX_URL);
          return r.json();
        })
      ])
        .then(function (loaded) {
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
        })
        .catch(function (err) {
          fuseLoading = null; // allow a retry on the next interaction
          throw err;
        });
    }
    return fuseLoading;
  }

  // Drop words shorter than MIN_QUERY: Fuse can never match them, so leaving
  // them in would zero out AND queries like "install a host".
  function prepareTerm(term) {
    return term
      .split(/\s+/)
      .filter(function (w) {
        return w.length >= MIN_QUERY;
      })
      .join(" ");
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
  function keywordSnippet(doc, matches) {
    var body = doc.body || "";
    var m = firstMatch(matches, "body");
    if (m) {
      var first = m.indices[0];
      var start = Math.max(0, first[0] - 60);
      var end = Math.min(body.length, first[1] + 1 + 60);
      var ranges = m.indices
        .filter(function (r) {
          return r[0] >= start && r[1] < end;
        })
        .map(function (r) {
          return [r[0] - start, r[1] - start];
        });
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
    return document.createTextNode(body.slice(0, 160) + (body.length > 160 ? "…" : ""));
  }

  function buildKeywordResult(doc, matches) {
    var link = el("a", "search-result");
    link.href = doc.path || doc.url;
    link.setAttribute("role", "option");
    var title = el("div", "search-result__title");
    var tm = firstMatch(matches, "title");
    title.appendChild(highlight(doc.title || doc.path || doc.url, tm ? tm.indices : null));
    var snip = el("div", "search-result__snippet");
    snip.appendChild(keywordSnippet(doc, matches));
    link.appendChild(title);
    link.appendChild(snip);
    return link;
  }

  function renderKeywordResults(term, note) {
    loadFuse()
      .then(function () {
        if (input.value.trim() !== term) return;
        var query = prepareTerm(term);
        clearResults();
        if (note) results.appendChild(noteRow(note));
        if (!query) {
          setOpen(!!note);
          return;
        }
        var hits = fuse.search(query);
        if (!hits.length) {
          results.appendChild(messageRow("No results"));
        } else {
          hits.slice(0, MAX_PAGES).forEach(function (item) {
            var link = buildKeywordResult(item.item, item.matches);
            results.appendChild(link);
            rendered.push(link);
          });
        }
        setActive(-1);
        setOpen(true);
      })
      .catch(function () {
        if (input.value.trim() !== term) return;
        clearResults();
        results.appendChild(messageRow("Search is unavailable. Try reloading the page."));
        setOpen(true);
      });
  }

  /* ---- request lifecycle ----------------------------------------------- */

  function abortAsk() {
    if (askAbort) {
      askAbort.abort();
      askAbort = null;
    }
    askInflight = false;
  }

  function abortAll() {
    if (aiAbort) {
      aiAbort.abort();
      aiAbort = null;
    }
    abortAsk();
  }

  function activate(row, term) {
    if (!row) return;
    if (row.classList && row.classList.contains("search-result--ask")) {
      startAsk(term);
    } else if (row.href) {
      window.location.assign(row.href);
    }
  }

  /* ---- events ----------------------------------------------------------- */

  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    abortAll();
    var term = input.value.trim();
    if (term.length < MIN_QUERY) {
      clearResults();
      setOpen(false);
      setStatus("");
      return;
    }
    debounceTimer = setTimeout(function () {
      runSearch(term);
    }, ENDPOINT ? AI_DEBOUNCE_MS : KEYWORD_DEBOUNCE_MS);
  });

  // Warm the local keyword index as soon as the search box is focused (AI mode
  // needs nothing: there is no local state to warm).
  input.addEventListener("focus", function () {
    if (!ENDPOINT) loadFuse().catch(function () {});
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      abortAll();
      clearResults();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!rendered.length) return;
      e.preventDefault();
      var delta = e.key === "ArrowDown" ? 1 : -1;
      var next = selectedIndex + delta;
      if (next < 0) next = rendered.length - 1;
      if (next >= rendered.length) next = 0;
      setActive(next);
      return;
    }
    if (e.key === "Enter") {
      var term = input.value.trim();
      if (!term) return;
      e.preventDefault();
      if (askInflight) return;
      if (selectedIndex >= 0 && rendered[selectedIndex]) {
        activate(rendered[selectedIndex], term);
        return;
      }
      // No row highlighted: with results on screen the first result keeps the
      // old fast path; with the panel closed (or an answer showing) Enter asks
      // the docs instead.
      if (results.classList.contains("is-open") && rendered.length) {
        activate(rendered[0], term);
      } else if (ENDPOINT) {
        startAsk(term);
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target !== input && !results.contains(e.target)) {
      abortAll();
      clearResults();
      setOpen(false);
    }
  });

  // Cmd/Ctrl+K focuses the search from anywhere on the page. The chip inside
  // the input advertises it; its label matches the platform.
  var chip = document.querySelector(".search-kbd");
  if (chip) {
    chip.textContent = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ K" : "Ctrl K";
    chip.addEventListener("click", function () {
      input.focus();
      input.select();
    });
  }

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K") && !e.altKey) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // Minimal combobox semantics for assistive tech.
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "search-results");
  input.setAttribute("aria-autocomplete", "list");
  results.setAttribute("role", "listbox");
})();
