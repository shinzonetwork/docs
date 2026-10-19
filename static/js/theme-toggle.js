// Light/dark theme toggle. The initial data-theme is set by an inline script
// in <head> (no FOUC). This flips the attribute, persists the choice, and
// notifies listeners (e.g. the Mermaid loader) via a "themechange" event.
(function () {
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function current() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function syncPressed() {
    btn.setAttribute("aria-pressed", current() === "dark" ? "true" : "false");
  }

  btn.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    syncPressed();
    window.dispatchEvent(new Event("themechange"));
  });

  syncPressed();
})();
