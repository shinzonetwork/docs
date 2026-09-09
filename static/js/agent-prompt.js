// "Copy prompt" button in the agent callout ({{ agent_prompt() }} shortcode).
// Clicking it copies the prompt text from the callout's <pre> to the
// clipboard. The callout's <pre> is skipped by copy-code.js, which only
// handles ordinary code blocks.
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

  function init() {
    var buttons = document.querySelectorAll(".agent-prompt__copy-btn");
    Array.prototype.forEach.call(buttons, function (button) {
      var callout = button.closest(".agent-prompt");
      var pre = callout && callout.querySelector(".agent-prompt__code");
      if (!pre) return;

      button.addEventListener("click", function () {
        // Strip a single trailing newline that browsers often add.
        var text = pre.innerText.replace(/\n$/, "");
        copyText(text).then(
          function () {
            button.textContent = "Copied!";
            button.classList.add("agent-prompt__copy-btn--copied");
            window.setTimeout(function () {
              button.textContent = "Copy prompt";
              button.classList.remove("agent-prompt__copy-btn--copied");
            }, 2000);
          },
          function () {
            button.textContent = "Error";
            window.setTimeout(function () {
              button.textContent = "Copy prompt";
            }, 2000);
          }
        );
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
