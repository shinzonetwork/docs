/* Scroll-scrubbed data journey (shortcode: journey_scroll.html)
 *
 * The markup renders the FINAL frame so the scene is complete without JS.
 * This script rewinds the scene to the reader's scroll position and scrubs
 * it as they scroll. With prefers-reduced-motion it leaves the final
 * frame untouched.
 */
(function () {
  "use strict";

  var wrap = document.getElementById("sj");
  if (!wrap) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function $(id) {
    return document.getElementById(id);
  }

  var path = $("sj-path");
  var sidePath1 = $("sj-side-path-1");
  var sidePath2 = $("sj-side-path-2");
  var raw = $("sj-packet-raw");
  var view = $("sj-packet-view");
  var seal = $("sj-seal");
  var side1 = $("sj-side-1");
  var side2 = $("sj-side-2");
  var card = $("sj-att-card");
  var votes = $("sj-votes");
  var voteDots = [$("sj-dot-1"), $("sj-dot-2"), $("sj-dot-3")];
  var query = $("sj-query");
  var shield = $("sj-shield");
  var stage = wrap.querySelector(".sj__stage");
  var stations = [
    $("sj-st-node"),
    $("sj-st-gen"),
    $("sj-st-host"),
    $("sj-st-lens"),
    $("sj-st-app"),
  ];
  var navDots = Array.prototype.slice.call(wrap.querySelectorAll(".sj__dot-nav"));
  var steps = Array.prototype.slice.call(wrap.querySelectorAll(".sj__step"));

  if (!path || !raw || !view || !stage) return;

  var total = path.getTotalLength();
  var sideTotal1 = sidePath1.getTotalLength();
  var sideTotal2 = sidePath2.getTotalLength();

  // Route fractions: node x=80, generator 255, host 450, lens gate 565, app 690.
  var F_GEN = (255 - 80) / 610;
  var F_HOST = (450 - 80) / 610;
  var F_GATE = (565 - 80) / 610;

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smooth(t) {
    t = clamp01(t);
    return t * t * (3 - 2 * t);
  }

  function seg(p, a, b) {
    return clamp01((p - a) / (b - a));
  }

  function placeOnPath(el, pth, len, t) {
    if (t <= 0 || t >= 1) {
      el.setAttribute("opacity", "0");
      return;
    }
    var pt = pth.getPointAtLength(t * len);
    el.setAttribute("opacity", "1");
    el.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
  }

  function frame(p) {
    // Main packet position, with dwells at the generator and the host.
    var f;
    if (p < 0.1) f = F_GEN * smooth(seg(p, 0.0, 0.1));
    else if (p < 0.24) f = F_GEN;
    else if (p < 0.4) f = F_GEN + (F_HOST - F_GEN) * smooth(seg(p, 0.24, 0.4));
    else if (p < 0.62) f = F_HOST;
    else if (p < 0.74) f = F_HOST + (F_GATE - F_HOST) * smooth(seg(p, 0.62, 0.74));
    else if (p < 0.88) f = F_GATE + (1 - F_GATE) * smooth(seg(p, 0.74, 0.88));
    else f = 1;

    var pt = path.getPointAtLength(f * total);
    var pastGate = f >= F_GATE;
    raw.setAttribute("opacity", pastGate ? "0" : "1");
    view.setAttribute("opacity", pastGate ? "1" : "0");
    (pastGate ? view : raw).setAttribute(
      "transform",
      "translate(" + pt.x + " " + pt.y + ")"
    );

    // Signature seal stamps on while dwelling at the Generator.
    var s = smooth(seg(p, 0.12, 0.19));
    seal.setAttribute("transform", "translate(18 -14) scale(" + s.toFixed(3) + ")");

    // The other Generators' copies merge into the Host.
    placeOnPath(side1, sidePath1, sideTotal1, seg(p, 0.43, 0.53));
    placeOnPath(side2, sidePath2, sideTotal2, seg(p, 0.53, 0.63));

    // Attestation record: card fades in, vote count climbs.
    card.setAttribute("opacity", seg(p, 0.4, 0.45).toFixed(3));
    var v = p < 0.4 ? 0 : 1 + (p >= 0.53 ? 1 : 0) + (p >= 0.63 ? 1 : 0);
    votes.textContent = String(v);
    for (var i = 0; i < 3; i++) {
      voteDots[i].classList.toggle("sj-filled", i < v);
    }

    // GraphQL query and verified shield at the app.
    query.setAttribute("opacity", seg(p, 0.89, 0.94).toFixed(3));
    shield.setAttribute("opacity", seg(p, 0.93, 0.98).toFixed(3));

    // Active step, station, and nav dot.
    var step = Math.min(4, Math.floor(p * 5));
    for (var j = 0; j < 5; j++) {
      stations[j].classList.toggle("sj-on", j === step);
      navDots[j].classList.toggle("sj-on", j === step);
      steps[j].classList.toggle("sj--active", j === step);
    }
  }

  var stickyTop = parseFloat(window.getComputedStyle(stage).top) || 0;
  var ticking = false;

  function update() {
    ticking = false;
    var rect = wrap.getBoundingClientRect();
    var scrollable = wrap.offsetHeight - stage.offsetHeight;
    if (scrollable <= 0) return;
    frame(clamp01((stickyTop - rect.top) / scrollable));
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    stickyTop = parseFloat(window.getComputedStyle(stage).top) || 0;
    onScroll();
  });

  update();
})();
