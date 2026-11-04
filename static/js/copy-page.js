// "Copy page for AI" button: copies the current page's markdown (embedded in
// the page as base64 by page.html) plus its title and canonical URL, so the
// reader can paste it straight into an AI agent.
(function () {
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older / non-secure contexts.
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // atob() gives a binary string; decode as UTF-8 so non-ASCII prose survives.
  function decodeBase64(b64) {
    var bin = atob(b64);
    var bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
    return new TextDecoder().decode(bytes);
  }

  function init() {
    var button = document.querySelector(".copy-page-button");
    var source = document.querySelector(".copy-page-source");
    if (!button || !source) return;

    button.addEventListener("click", function () {
      var markdown = decodeBase64(source.textContent.trim());
      var text =
        "# " + source.getAttribute("data-title") + "\n\n" +
        source.getAttribute("data-url") + "\n\n" +
        markdown;

      copyText(text).then(
        function () {
          button.textContent = "Copied!";
          button.classList.add("copy-page-button--copied");
          window.setTimeout(function () {
            button.textContent = "Copy page for AI";
            button.classList.remove("copy-page-button--copied");
          }, 2000);
        },
        function () {
          button.textContent = "Error";
          window.setTimeout(function () {
            button.textContent = "Copy page for AI";
          }, 2000);
        }
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
