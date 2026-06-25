// Client-side search backed by Zola's generated elasticlunr index
// (search_index.en.js + elasticlunr.min.js). Mirrors the local search that
// @easyops-cn/docusaurus-search-local provided.
(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  if (!input || !results || typeof elasticlunr === "undefined") return;

  var index = elasticlunr.Index.load(window.searchIndex);

  function render(matches) {
    if (!matches.length) {
      results.innerHTML =
        '<div class="search-result"><div class="search-result__snippet">No results</div></div>';
      results.classList.add("is-open");
      return;
    }
    results.innerHTML = matches
      .slice(0, 10)
      .map(function (m) {
        var doc = index.documentStore.getDoc(m.ref);
        var title = doc.title || m.ref;
        var body = (doc.body || "").replace(/<[^>]+>/g, "").slice(0, 120);
        return (
          '<a class="search-result" href="' +
          m.ref +
          '"><div class="search-result__title">' +
          title +
          '</div><div class="search-result__snippet">' +
          body +
          "…</div></a>"
        );
      })
      .join("");
    results.classList.add("is-open");
  }

  input.addEventListener("input", function () {
    var term = input.value.trim();
    if (term.length < 2) {
      results.classList.remove("is-open");
      results.innerHTML = "";
      return;
    }
    var matches = index.search(term, {
      bool: "AND",
      expand: true,
    });
    render(matches);
  });

  document.addEventListener("click", function (e) {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove("is-open");
    }
  });
})();
