/* Ambient living diagram (shortcode: journey_loop.html)
 *
 * The loop itself is pure CSS. This script only adds what CSS can't do:
 * a pause/play toggle, pausing while the diagram is offscreen, and the
 * attestation vote counter cycling 1 -> 2 -> 3.
 */
(function () {
  "use strict";

  var root = document.getElementById("jal");
  if (!root) return;

  var btn = document.getElementById("jal-pause");
  var votes = document.getElementById("jal-votes");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Pause the loop while it is scrolled out of view.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        root.classList.toggle("jal--off", !entries[0].isIntersecting);
      },
      { threshold: 0.05 }
    ).observe(root);
  }

  if (btn) {
    btn.addEventListener("click", function () {
      var paused = root.classList.toggle("jal--paused");
      btn.setAttribute("aria-pressed", paused ? "true" : "false");
      btn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
    });
  }

  if (votes) {
    if (reduced) {
      votes.textContent = "3";
    } else {
      var v = 1;
      window.setInterval(function () {
        v = (v % 3) + 1;
        votes.textContent = String(v);
      }, 900);
    }
  }
})();
