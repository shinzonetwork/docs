/* Step-through guided player (shortcode: journey_player.html)
 *
 * Step captions live in hidden divs in the shortcode body (editable in the
 * markdown page). This script turns them into a state machine: each step is
 * a CSS class on the root (.jp--s1 ... .jp--s6) and CSS transitions do the
 * animation. The only scripted motion is the two side packets merging into
 * the Host during the attestation step.
 */
(function () {
  "use strict";

  var root = document.getElementById("jp");
  if (!root) return;

  function $(id) {
    return document.getElementById(id);
  }

  var titleEl = $("jp-title");
  var bodyEl = $("jp-body");
  var prevBtn = $("jp-prev");
  var nextBtn = $("jp-next");
  var playBtn = $("jp-play");
  var dotsWrap = $("jp-dots");
  var countEl = $("jp-count");
  var progress = $("jp-progress");
  var votesEl = $("jp-votes");
  var voteDots = [$("jp-dot-1"), $("jp-dot-2"), $("jp-dot-3")];
  var side1 = $("jp-side-1");
  var side2 = $("jp-side-2");
  var sidePath1 = $("jp-side-path-1");
  var sidePath2 = $("jp-side-path-2");

  var captionDivs = root.querySelectorAll(".jp__captions .jp__caption");
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
    node: $("jp-st-node"),
    gen: $("jp-st-gen"),
    host: $("jp-st-host"),
    lens: $("jp-st-lens"),
    app: $("jp-st-app"),
    gen2: $("jp-st-gen2"),
    gen3: $("jp-st-gen3"),
  };
  var stationList = Object.keys(stations).map(function (k) {
    return stations[k];
  });

  // Stations highlighted on each step (0-based step index).
  var highlight = [
    ["node"],
    ["gen"],
    ["host"],
    ["host", "gen2", "gen3"],
    ["lens"],
    ["app"],
  ];

  var cur = 0;
  var playing = false;
  var timer = null;
  var pending = []; // timeout / rAF ids for side-packet motion
  var PLAY_MS = 4600;
  var SIDE_MS = 750;

  function setVotes(v) {
    votesEl.textContent = String(v);
    for (var k = 0; k < 3; k++) {
      voteDots[k].classList.toggle("jp-filled", k < v);
    }
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

  // Tween a side packet along its path; call done() when it arrives.
  function tweenSide(sideEl, pathEl, delay, done) {
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
          done();
        }
      };
      pending.push(window.requestAnimationFrame(tick));
    }, delay);
    pending.push(tid);
  }

  var dots = [];
  for (var d = 0; d < N; d++) {
    (function (idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "jp__dot";
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
    for (var s = 1; s <= N; s++) root.classList.remove("jp--s" + s);
    root.classList.add("jp--s" + (i + 1));

    titleEl.textContent = captions[i].title;
    bodyEl.innerHTML = captions[i].html;

    for (var j = 0; j < N; j++) {
      dots[j].classList.toggle("jp-on", j === i);
      dots[j].setAttribute("aria-selected", j === i ? "true" : "false");
    }
    countEl.textContent = i + 1 + " / " + N;
    progress.style.width = ((i + 1) / N) * 100 + "%";
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === N - 1;

    for (var q = 0; q < stationList.length; q++) {
      stationList[q].classList.remove("jp-on");
    }
    var active = highlight[i] || [];
    for (var a = 0; a < active.length; a++) {
      stations[active[a]].classList.add("jp-on");
    }

    // Attestation state per step.
    cancelPending();
    if (i < 3) {
      hideSides();
      setVotes(1);
    } else if (i === 3) {
      hideSides();
      setVotes(1);
      tweenSide(side1, sidePath1, 350, function () {
        setVotes(2);
      });
      tweenSide(side2, sidePath2, 1050, function () {
        setVotes(3);
      });
    } else {
      hideSides();
      setVotes(3);
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
    root.classList.add("jp--playing");
    playBtn.setAttribute("aria-label", "Pause");
    timer = window.setInterval(tickPlay, PLAY_MS);
  }

  function pause() {
    playing = false;
    root.classList.remove("jp--playing");
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
