/* Step-through guided player (shortcode: pool_player.html)
 *
 * Step captions live in hidden divs in the shortcode body (editable in the
 * markdown page). This script turns them into a state machine: each step is
 * a CSS class on the root (.pp--s1 ... .pp--s6) and CSS transitions do the
 * animation. The scripted motion is the Host tokens: each tweens along its
 * join path into a pool slot, and the last step plays one exit and one
 * rejoin so the active/inactive flip has real actors. Under
 * prefers-reduced-motion the tokens jump straight to their positions.
 */
(function () {
  "use strict";

  var root = document.getElementById("pp");
  if (!root) return;

  function $(id) {
    return document.getElementById(id);
  }

  var titleEl = $("pp-title");
  var bodyEl = $("pp-body");
  var prevBtn = $("pp-prev");
  var nextBtn = $("pp-next");
  var playBtn = $("pp-play");
  var dotsWrap = $("pp-dots");
  var countEl = $("pp-count");
  var progress = $("pp-progress");
  var hostsEl = $("pp-hosts");
  var hostDots = [$("pp-dot-1"), $("pp-dot-2"), $("pp-dot-3")];
  var tokens = [$("pp-token-1"), $("pp-token-2"), $("pp-token-3"), $("pp-token-4")];
  var paths = [$("pp-join-1"), $("pp-join-2"), $("pp-join-3"), $("pp-join-4")];

  var captionDivs = root.querySelectorAll(".pp__captions .pp__caption");
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
    dev: $("pp-st-dev"),
    registry: $("pp-st-registry"),
    pool: $("pp-st-pool"),
    h1: $("pp-st-h1"),
    h2: $("pp-st-h2"),
    h3: $("pp-st-h3"),
    h4: $("pp-st-h4"),
  };
  var stationList = Object.keys(stations).map(function (k) {
    return stations[k];
  });

  // Stations highlighted on each step (0-based step index).
  var highlight = [
    ["dev"],
    ["registry"],
    ["pool"],
    ["pool", "h1"],
    ["pool", "h2", "h3"],
    ["pool", "h3", "h4"],
  ];

  var cur = 0;
  var playing = false;
  var timer = null;
  var pending = []; // timeout / rAF ids for token motion
  var PLAY_MS = 4600;
  var SIDE_MS = 750;
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) SIDE_MS = 1;

  function delay(ms) {
    return reduced ? 0 : ms;
  }

  function setHosts(v) {
    hostsEl.textContent = String(v);
    for (var k = 0; k < 3; k++) {
      hostDots[k].classList.toggle("pp-filled", k < v);
    }
  }

  function setActive(on) {
    root.classList.toggle("pp-live", on);
  }

  function hideTokens() {
    for (var i = 0; i < tokens.length; i++) {
      tokens[i].setAttribute("opacity", "0");
    }
  }

  // Park a token on its slot: the end point of its join path.
  function parkToken(i) {
    var path = paths[i];
    var pt = path.getPointAtLength(path.getTotalLength());
    tokens[i].setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
    tokens[i].setAttribute("opacity", "1");
  }

  function cancelPending() {
    for (var i = 0; i < pending.length; i++) {
      window.clearTimeout(pending[i]);
      window.cancelAnimationFrame(pending[i]);
    }
    pending = [];
  }

  // Tween a token along its join path. Forward runs station -> slot and
  // leaves the token parked there; reverse runs slot -> station and hides
  // it on arrival. Call done() when it lands.
  function tweenToken(i, reverse, delayMs, done) {
    var path = paths[i];
    var el = tokens[i];
    var len = path.getTotalLength();
    var tid = window.setTimeout(function () {
      var start = null;
      var tick = function (ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / SIDE_MS);
        var eased = t * t * (3 - 2 * t);
        var d = reverse ? len * (1 - eased) : len * eased;
        var pt = path.getPointAtLength(d);
        el.setAttribute("opacity", "1");
        el.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
        if (t < 1) {
          pending.push(window.requestAnimationFrame(tick));
        } else {
          if (reverse) el.setAttribute("opacity", "0");
          if (done) done();
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
      b.className = "pp__dot";
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
    for (var s = 1; s <= N; s++) root.classList.remove("pp--s" + s);
    root.classList.add("pp--s" + (i + 1));

    titleEl.textContent = captions[i].title;
    bodyEl.innerHTML = captions[i].html;

    for (var j = 0; j < N; j++) {
      dots[j].classList.toggle("pp-on", j === i);
      dots[j].setAttribute("aria-selected", j === i ? "true" : "false");
    }
    countEl.textContent = i + 1 + " / " + N;
    progress.style.width = ((i + 1) / N) * 100 + "%";
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === N - 1;

    for (var q = 0; q < stationList.length; q++) {
      stationList[q].classList.remove("pp-on");
    }
    var active = highlight[i] || [];
    for (var a = 0; a < active.length; a++) {
      stations[active[a]].classList.add("pp-on");
    }

    // Pool state per step.
    cancelPending();
    hideTokens();
    setActive(false);
    if (i < 3) {
      setHosts(0);
    } else if (i === 3) {
      setHosts(0);
      tweenToken(0, false, delay(300), function () {
        setHosts(1);
      });
    } else if (i === 4) {
      parkToken(0);
      setHosts(1);
      tweenToken(1, false, delay(350), function () {
        setHosts(2);
      });
      tweenToken(2, false, delay(1050), function () {
        setHosts(3);
        setActive(true);
      });
    } else {
      parkToken(0);
      parkToken(1);
      parkToken(2);
      setHosts(3);
      setActive(true);
      tweenToken(2, true, delay(500), function () {
        setHosts(2);
        setActive(false);
      });
      tweenToken(3, false, delay(2200), function () {
        setHosts(3);
        setActive(true);
      });
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
    root.classList.add("pp--playing");
    playBtn.setAttribute("aria-label", "Pause");
    timer = window.setInterval(tickPlay, PLAY_MS);
  }

  function pause() {
    playing = false;
    root.classList.remove("pp--playing");
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
