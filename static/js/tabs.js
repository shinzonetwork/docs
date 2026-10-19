// Turns {{ tab(label="...") }} ... {{ endtab() }} marker pairs into a tabbed
// widget. Each `tab` shortcode renders a .tabs__start marker and each `endtab`
// renders a .tabs__end marker; the page markdown parser handles the content
// between them (so fenced code blocks keep correct list-context indentation).
// This script collects the sibling nodes between each start/end pair into a
// .tabs__panel, removes the markers, then groups runs of adjacent panels into
// a .tabs container, builds a tab bar from the panels' data-tab-label
// attributes, and shows only the first. Without JS, every panel's content
// stacks in order, so content stays readable.
(function () {
  var idCounter = 0;

  // Whether a node is an ignorable whitespace-only text node.
  function isBlank(node) {
    return node.nodeType === 3 && /^\s*$/.test(node.nodeValue);
  }

  // Remove leading/trailing whitespace-only text nodes from a container.
  function trimWhitespace(container) {
    while (container.firstChild && isBlank(container.firstChild)) {
      container.removeChild(container.firstChild);
    }
    while (container.lastChild && isBlank(container.lastChild)) {
      container.removeChild(container.lastChild);
    }
  }

  // Find the next element sibling matching `selector`, starting after `node`.
  function findNextMarker(node, selector) {
    var cur = node.nextSibling;
    while (cur) {
      if (cur.nodeType === 1 && cur.matches(selector)) return cur;
      cur = cur.nextSibling;
    }
    return null;
  }

  // Build a .tabs__panel from each .tabs__start / .tabs__end marker pair:
  // move every sibling between the markers into the panel, replace the start
  // marker with the panel, and remove the end marker. Returns the panels in
  // document order.
  function buildPanels() {
    var starts = Array.prototype.slice.call(
      document.querySelectorAll(".tabs__start")
    );
    var panels = [];

    starts.forEach(function (start) {
      var end = findNextMarker(start, ".tabs__end");
      if (!end) return; // unbalanced markers: leave content as-is

      var panel = document.createElement("div");
      panel.className = "tabs__panel";
      panel.setAttribute(
        "data-tab-label",
        start.getAttribute("data-tab-label") || ""
      );

      // Move siblings between start (exclusive) and end (exclusive) in.
      var node = start.nextSibling;
      while (node && node !== end) {
        var next = node.nextSibling;
        panel.appendChild(node);
        node = next;
      }

      trimWhitespace(panel);

      // Replace the start marker with the panel, then drop the end marker.
      start.parentNode.insertBefore(panel, start);
      start.parentNode.removeChild(start);
      end.parentNode.removeChild(end);

      panels.push(panel);
    });

    return panels;
  }

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
        if (isBlank(node)) {
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
    buildPanels();
    var allPanels = Array.prototype.slice.call(
      document.querySelectorAll(".tabs__panel")
    );
    var groups = groupPanels(allPanels);
    groups.forEach(build);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
