// Scroll-spy for the table of contents. Highlights the TOC link whose heading
// is currently the closest one at/above the top of the viewport, so the reader
// can see which section of the page they're in.
(function () {
  var toc = document.querySelector(".toc");
  if (!toc) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll(".toc__link"));
  if (!links.length) return;

  // Map heading id -> TOC link.
  var linkById = {};
  var headings = [];
  links.forEach(function (link) {
    var href = link.getAttribute("href") || "";
    var hash = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#") + 1) : "";
    if (!hash) return;
    var el = document.getElementById(decodeURIComponent(hash));
    if (el) {
      linkById[el.id] = link;
      headings.push(el);
    }
  });
  if (!headings.length) return;

  function clearActive() {
    links.forEach(function (l) {
      l.classList.remove("toc__link--active");
    });
  }

  function setActive(id) {
    var link = linkById[id];
    if (!link) return;
    clearActive();
    link.classList.add("toc__link--active");
  }

  // Offset for the sticky navbar so a heading counts as "current" once it
  // reaches just below the navbar.
  function navbarOffset() {
    var nav = document.querySelector(".navbar");
    return (nav ? nav.offsetHeight : 0) + 16;
  }

  function onScroll() {
    var offset = navbarOffset();
    var current = headings[0];
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - offset <= 1) {
        current = headings[i];
      } else {
        break;
      }
    }
    // If we're at the very bottom of the page, highlight the last heading.
    if (
      window.innerHeight + window.scrollY >=
      document.body.scrollHeight - 2
    ) {
      current = headings[headings.length - 1];
    }
    setActive(current.id);
  }

  var ticking = false;
  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  onScroll();
})();
