// Turns consecutive {% tab(label="...") %}...{% end %} panels into a tabbed
// widget. Each `tab` shortcode renders a .tabs__panel; this script groups runs
// of adjacent sibling panels, wraps each run in a .tabs container, builds a tab
// bar from the panels' data-tab-label attributes, and shows only the first.
// Without JS, every panel stacks in order, so content stays readable.
(function () {
  var idCounter = 0;

  // Collect maximal runs of consecutive .tabs__panel siblings (whitespace text
  // nodes between them are ignored). Returns an array of arrays.
  function groupPanels(allPanels) {
    var seen = [];
    var groups = [];

    function isHandled(panel) {
      return seen.indexOf(panel) !== -1;
    }

    allPanels.forEach(function (panel) {
      if (isHandled(panel)) return;

      var run = [panel];
      seen.push(panel);

      var node = panel.nextSibling;
      while (node) {
        if (node.nodeType === 3 && /^\s*$/.test(node.nodeValue)) {
          node = node.nextSibling;
          continue;
        }
        if (
          node.nodeType === 1 &&
          node.classList.contains("tabs__panel") &&
          !isHandled(node)
        ) {
          run.push(node);
          seen.push(node);
          node = node.nextSibling;
          continue;
        }
        break;
      }

      groups.push(run);
    });

    return groups;
  }

  function build(run) {
    if (run.length < 2) return; // a lone panel needs no tab bar

    var first = run[0];
    var container = document.createElement("div");
    container.className = "tabs";
    container.setAttribute("data-tabs", "");
    first.parentNode.insertBefore(container, first);

    var bar = document.createElement("div");
    bar.className = "tabs__bar";
    bar.setAttribute("role", "tablist");

    run.forEach(function (panel, index) {
      var label =
        panel.getAttribute("data-tab-label") || "Tab " + (index + 1);
      var panelId = "tabs-panel-" + ++idCounter;
      var tabId = "tabs-tab-" + idCounter;
      panel.id = panelId;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);
      container.appendChild(panel);

      var button = document.createElement("button");
      button.type = "button";
      button.id = tabId;
      button.className = "tabs__button";
      button.textContent = label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", panelId);
      button.setAttribute("aria-selected", "false");

      button.addEventListener("click", function () {
        select(run, bar, panel);
      });

      bar.appendChild(button);
    });

    container.insertBefore(bar, container.firstChild);
    select(run, bar, run[0]);
  }

  function select(run, bar, active) {
    run.forEach(function (panel) {
      panel.hidden = panel !== active;
    });
    Array.prototype.forEach.call(bar.children, function (button) {
      var isActive = button.getAttribute("aria-controls") === active.id;
      button.setAttribute("aria-selected", String(isActive));
      button.classList.toggle("tabs__button--active", isActive);
    });
  }

  function init() {
    var panels = Array.prototype.slice.call(
      document.querySelectorAll(".tabs__panel")
    );
    var groups = groupPanels(panels);
    groups.forEach(build);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
