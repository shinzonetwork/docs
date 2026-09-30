/* Step-through guided player (shortcode: view_player.html)
 *
 * Step captions live in hidden divs in the shortcode body (editable in the
 * markdown page). This script turns them into a state machine: each step is
 * a CSS class on the root (.vp--s1 ... .vp--s6) and CSS transitions do the
 * animation. The only scripted motion is the two primitive packets flying
 * from the Generator clients into the Host, on the first and fifth steps.
 * Under prefers-reduced-motion the packets jump straight to the Host.
 */
(function () {
  "use strict";

  var root = document.getElementById("vp");
  if (!root) return;

  function $(id) {
    return document.getElementById(id);
  }

  var titleEl = $("vp-title");
  var bodyEl = $("vp-body");
  var prevBtn = $("vp-prev");
  var nextBtn = $("vp-next");
  var playBtn = $("vp-play");
  var dotsWrap = $("vp-dots");
  var countEl = $("vp-count");
  var progress = $("vp-progress");
  var side1 = $("vp-side-1");
  var side2 = $("vp-side-2");
  var sidePath1 = $("vp-side-path-1");
  var sidePath2 = $("vp-side-path-2");

  var captionDivs = root.querySelectorAll(".vp__captions .vp__caption");
  var captions = [];
  for (var i = 0; i < captionDivs.length; i++) {
    captions.push({
      title: captionDivs[i].getAttribute("data-title") || "",
      html: captionDivs[i].innerHTML,
    });
  }
  var N = captions.length;
  if (!N) return;

  var stations = {
    dev: $("vp-st-dev"),
    bundle: $("vp-st-bundle"),
    hub: $("vp-st-hub"),
    host: $("vp-st-host"),
    app: $("vp-st-app"),
    gen2: $("vp-st-gen2"),
    gen3: $("vp-st-gen3"),
  };
  var stationList = Object.keys(stations).map(function (k) {
    return stations[k];
  });

  // Stations highlighted on each step (0-based step index).
  var highlight = [
    ["gen2", "gen3"],
    ["dev"],
    ["bundle"],
    ["hub"],
    ["host", "gen2", "gen3"],
    ["app"],
  ];

  var cur = 0;
  var playing = false;
  var timer = null;
  var pending = []; // timeout / rAF ids for side-packet motion
  var PLAY_MS = 4600;
  var SIDE_MS = 750;
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) SIDE_MS = 1;

  function delay(ms) {
    return reduced ? 0 : ms;
  }

  function hideSides() {
    side1.setAttribute("opacity", "0");
    side2.setAttribute("opacity", "0");
  }

  function cancelPending() {
    for (var i = 0; i < pending.length; i++) {
      window.clearTimeout(pending[i]);
      window.cancelAnimationFrame(pending[i]);
    }
    pending = [];
  }

  // Tween a primitive packet along its path into the Host.
  function tweenSide(sideEl, pathEl, delayMs) {
    var len = pathEl.getTotalLength();
    var tid = window.setTimeout(function () {
      var start = null;
      var tick = function (ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / SIDE_MS);
        var eased = t * t * (3 - 2 * t);
        var pt = pathEl.getPointAtLength(eased * len);
        sideEl.setAttribute("opacity", "1");
        sideEl.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
        if (t < 1) {
          pending.push(window.requestAnimationFrame(tick));
        } else {
          sideEl.setAttribute("opacity", "0");
        }
      };
      pending.push(window.requestAnimationFrame(tick));
    }, delayMs);
    pending.push(tid);
  }

  var dots = [];
  for (var d = 0; d < N; d++) {
    (function (idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vp__dot";
      b.setAttribute("aria-label", "Step " + (idx + 1) + ": " + captions[idx].title);
      b.addEventListener("click", function () {
        go(idx);
      });
      dotsWrap.appendChild(b);
      dots.push(b);
    })(d);
  }

  function apply(i) {
    cur = i;
    for (var s = 1; s <= N; s++) root.classList.remove("vp--s" + s);
    root.classList.add("vp--s" + (i + 1));

    titleEl.textContent = captions[i].title;
    bodyEl.innerHTML = captions[i].html;

    for (var j = 0; j < N; j++) {
      dots[j].classList.toggle("vp-on", j === i);
      dots[j].setAttribute("aria-selected", j === i ? "true" : "false");
    }
    countEl.textContent = i + 1 + " / " + N;
    progress.style.width = ((i + 1) / N) * 100 + "%";
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === N - 1;

    for (var q = 0; q < stationList.length; q++) {
      stationList[q].classList.remove("vp-on");
    }
    var active = highlight[i] || [];
    for (var a = 0; a < active.length; a++) {
      stations[active[a]].classList.add("vp-on");
    }

    // Primitives fly into the Host while it runs the View (steps 1 and 5).
    cancelPending();
    hideSides();
    if (i === 0 || i === 4) {
      tweenSide(side1, sidePath1, delay(350));
      tweenSide(side2, sidePath2, delay(1050));
    }

    if (i === N - 1) pause();
  }

  function go(i) {
    apply(i);
    if (playing) {
      window.clearInterval(timer);
      timer = window.setInterval(tickPlay, PLAY_MS);
    }
  }

  function tickPlay() {
    if (cur === N - 1) {
      pause();
      return;
    }
    apply(cur + 1);
  }

  function play() {
    if (cur === N - 1) apply(0); // replay from the top
    playing = true;
    root.classList.add("vp--playing");
    playBtn.setAttribute("aria-label", "Pause");
    timer = window.setInterval(tickPlay, PLAY_MS);
  }

  function pause() {
    playing = false;
    root.classList.remove("vp--playing");
    playBtn.setAttribute("aria-label", "Play");
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  prevBtn.addEventListener("click", function () {
    if (cur > 0) go(cur - 1);
  });
  nextBtn.addEventListener("click", function () {
    if (cur < N - 1) go(cur + 1);
  });
  playBtn.addEventListener("click", function () {
    if (playing) pause();
    else play();
  });

  // Arrow keys, but only while the player is on screen and the reader is
  // not typing in a field.
  var inView = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
    }).observe(root);
  }
  document.addEventListener("keydown", function (e) {
    if (!inView) return;
    var t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowLeft" && cur > 0) {
      e.preventDefault();
      go(cur - 1);
    } else if (e.key === "ArrowRight" && cur < N - 1) {
      e.preventDefault();
      go(cur + 1);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
  });

  apply(0);
})();
