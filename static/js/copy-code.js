// Adds a "Copy" button to every code block that is not an output block.
// Clicking it copies the entire contents of that code block to the clipboard.
(function () {
  function getCodeText(pre) {
    var code = pre.querySelector("code");
    var text = (code || pre).innerText;
    // Strip a single trailing newline that browsers often add.
    return text.replace(/\n$/, "");
  }

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

  function addButton(pre) {
    if (pre.querySelector(".copy-code-button")) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code-button";
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.textContent = "Copy";

    button.addEventListener("click", function () {
      copyText(getCodeText(pre)).then(
        function () {
          button.textContent = "Copied!";
          button.classList.add("copy-code-button--copied");
          window.setTimeout(function () {
            button.textContent = "Copy";
            button.classList.remove("copy-code-button--copied");
          }, 2000);
        },
        function () {
          button.textContent = "Error";
          window.setTimeout(function () {
            button.textContent = "Copy";
          }, 2000);
        }
      );
    });

    // The button is absolutely positioned relative to a wrapper.
    var wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(button);
  }

  function init() {
    // All <pre> code blocks inside rendered markdown, excluding those inside an
    // output block (.code-output) which intentionally have no copy button.
    var pres = document.querySelectorAll(".markdown pre");
    Array.prototype.forEach.call(pres, function (pre) {
      if (pre.closest(".code-output")) return;
      if (pre.closest(".mermaid-container")) return;
      addButton(pre);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
