// Collapsible sidebar subsections (e.g. "Deployment Examples").
// Each subsection renders expanded by default; clicking its header toggles the
// visibility of the child page list. Without JS the lists stay open and readable.
(function () {
  function init() {
    var toggles = Array.prototype.slice.call(
      document.querySelectorAll(".menu__link--sublist, .menu__caret-button")
    );
    toggles.forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        var item = toggle.closest(".menu__list-item--sub");
        if (!item) return;
        var collapsed = item.classList.toggle("menu__list-item--collapsed");
        var controls = item.querySelectorAll("[aria-expanded]");
        Array.prototype.forEach.call(controls, function (ctrl) {
          ctrl.setAttribute("aria-expanded", collapsed ? "false" : "true");
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
