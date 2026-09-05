// Auto-detects glossary terms in the page body and shows a short-definition
// tooltip on hover (desktop), tap (touch), or keyboard focus. Term data comes
// from window.glossaryTerms, injected at build time from data/glossary.json by
// templates/partials/glossary-data.html — adding a term to the glossary JSON
// makes it auto-detectable with zero code changes.
//
// ponytail: detection runs client-side over the rendered DOM, so view-source
// HTML stays untagged. Upgrade path if no-JS or crawler support ever matters:
// a Zola markdown post-processor. Tooltips are pure progressive enhancement,
// so it won't.
(function () {
  var terms = window.glossaryTerms;
  if (!terms) return;

  var article = document.querySelector("article.markdown");
  if (!article) return;

  // One alternation, longest first, so multi-word phrases ("Merkle Tree") win
  // over their prefixes and every occurrence on the page gets tagged, not just
  // the first. Whole-word boundaries on both ends keep "View" from matching
  // inside "ViewKit" or "review".
  var names = Object.keys(terms).sort(function (a, b) { return b.length - a.length; });
  if (!names.length) return;
  var escaped = names.map(function (n) {
    return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  var re = new RegExp("\\b(" + escaped.join("|") + ")\\b", "gi");

  // Subtrees where a tooltip would get in the way: code blocks, inline code,
  // existing links, headings (also keeps the page TOC clean), and Mermaid
  // diagrams (tagging a node label corrupts the diagram source text).
  var SKIP = { CODE: 1, PRE: 1, A: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SCRIPT: 1, STYLE: 1 };

  function insideSkipped(node) {
    for (var n = node.parentNode; n && n !== article; n = n.parentNode) {
      if (SKIP[n.nodeName]) return true;
      if (n.classList && n.classList.contains("mermaid")) return true;
    }
    return false;
  }

  var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  var textNodes = [];
  var node;
  while ((node = walker.nextNode())) textNodes.push(node);

  textNodes.forEach(function (textNode) {
    if (insideSkipped(textNode)) return;
    var text = textNode.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) return;

    var frag = document.createDocumentFragment();
    var last = 0;
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement("span");
      span.className = "glossary-term";
      span.textContent = m[0];
      span.setAttribute("tabindex", "0");
      span.setAttribute("data-term", m[1].toLowerCase());
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  });

  // --- Tooltip UI: one shared div, CSS does all styling, JS only positions
  // and toggles it.
  var tip = document.createElement("div");
  tip.className = "glossary-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);

  var current = null;

  function show(target) {
    var def = terms[target.getAttribute("data-term")];
    if (!def) return;
    current = target;
    tip.innerHTML = def;
    tip.hidden = false;

    var r = target.getBoundingClientRect();
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var left = r.left + window.scrollX + r.width / 2 - tw / 2;
    var top = r.top + window.scrollY - th - 8;

    // Flip below the term when there is no room above; clamp horizontally so
    // the card never leaves the viewport (matters on narrow phones).
    if (top < window.scrollY + 4) top = r.bottom + window.scrollY + 8;
    left = Math.max(window.scrollX + 4, Math.min(left, window.scrollX + document.documentElement.clientWidth - tw - 4));

    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hide() {
    current = null;
    tip.hidden = true;
  }

  article.addEventListener("mouseover", function (e) {
    var t = e.target.closest && e.target.closest(".glossary-term");
    if (t) show(t);
  });
  article.addEventListener("mouseout", function (e) {
    var t = e.target.closest && e.target.closest(".glossary-term");
    if (t && t === current && !(e.relatedTarget && tip.contains(e.relatedTarget))) hide();
  });
  article.addEventListener("focusin", function (e) {
    if (e.target.classList && e.target.classList.contains("glossary-term")) show(e.target);
  });
  article.addEventListener("focusout", function (e) {
    if (e.target.classList && e.target.classList.contains("glossary-term")) hide();
  });
  // Touch: tap toggles, tap elsewhere dismisses.
  article.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".glossary-term");
    if (t) {
      if (t === current) { hide(); } else { show(t); }
      e.preventDefault();
    }
  });
  document.addEventListener("click", function (e) {
    if (current && !tip.contains(e.target) && !(e.target.closest && e.target.closest(".glossary-term"))) hide();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });
  window.addEventListener("scroll", hide, { passive: true });
})();
