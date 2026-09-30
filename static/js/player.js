/* Generic step-through guided player (shortcode: player.html)
 *
 * Scenes live in templates/player-scenes/*.html; captions live in the
 * shortcode body (.player__caption divs in the markdown page). Each step is
 * a CSS class on the root (.player--s1 ... .player--sN) and scene CSS does
 * most of the animation. The rest is declared with data attributes:
 *
 *   data-steps="1,4"                   element highlights on those steps
 *   data-fly="#path-id"                tween this element along that path
 *   data-fly-steps="1,5"               fly forward on those steps
 *   data-fly-reverse-steps="6"         fly backward (path end -> start)
 *   data-park-steps="5,6"              sit at the path end on those steps
 *   data-fly-delay="350"               ms before the forward flight starts
 *   data-fly-reverse-delay="500"       ms before the reverse flight starts
 *   data-fly-arrive="votes:2"          set a counter when a forward flight lands
 *   data-fly-reverse-arrive="votes:2"  same for a reverse flight
 *   data-counter="votes"               counter widget: contains one .num and
 *   data-counter-steps="1,1,1,1,3,3"     any number of .dot children; steps is
 *   data-counter-badge="3"               the value per step, badge adds .is-above
 *                                        to the widget when value >= threshold
 *
 * Under prefers-reduced-motion the flights are instant. Multiple players per
 * page are supported.
 */
(function () {
  "use strict";

  if (window.__playerEngineInit) return;
  window.__playerEngineInit = true;

  var PLAY_MS = 4600;
  var FLY_MS = 750;
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) FLY_MS = 1;

  function intList(el, attr) {
    var raw = el.getAttribute(attr);
    if (!raw) return [];
    return raw.split(",").map(function (x) {
      return parseInt(x.trim(), 10);
    });
  }

  function init(root) {
    function q(sel) {
      return root.querySelector(sel);
    }

    var titleEl = q(".js-title");
    var bodyEl = q(".js-body");
    var prevBtn = q(".js-prev");
    var nextBtn = q(".js-next");
    var playBtn = q(".js-play");
    var dotsWrap = q(".js-dots");
    var countEl = q(".js-count");
    var progress = q(".js-progress");

    var captionDivs = root.querySelectorAll(".player__caption");
    var captions = [];
    for (var i = 0; i < captionDivs.length; i++) {
      captions.push({
        title: captionDivs[i].getAttribute("data-title") || "",
        html: captionDivs[i].innerHTML,
      });
    }
    var N = captions.length;
    if (!N) return;

    // Elements highlighted on given steps (stations and friends).
    var lit = [];
    var litEls = root.querySelectorAll("[data-steps]");
    for (i = 0; i < litEls.length; i++) {
      lit.push({ el: litEls[i], steps: intList(litEls[i], "data-steps") });
    }

    // Counters, keyed by name.
    var counters = {};
    var cEls = root.querySelectorAll("[data-counter]");
    for (i = 0; i < cEls.length; i++) {
      var badge = cEls[i].getAttribute("data-counter-badge");
      counters[cEls[i].getAttribute("data-counter")] = {
        el: cEls[i],
        num: cEls[i].querySelector(".num"),
        dots: cEls[i].querySelectorAll(".dot"),
        steps: intList(cEls[i], "data-counter-steps"),
        badge: badge === null ? NaN : parseInt(badge, 10),
      };
    }

    function setCounter(name, value) {
      var c = counters[name];
      if (!c) return;
      c.num.textContent = String(value);
      for (var k = 0; k < c.dots.length; k++) {
        c.dots[k].classList.toggle("filled", k < value);
      }
      if (!isNaN(c.badge)) c.el.classList.toggle("is-above", value >= c.badge);
    }

    // spec is "name:value" (data-fly-arrive / data-fly-reverse-arrive).
    function bumpCounter(spec) {
      if (!spec) return;
      var parts = spec.split(":");
      setCounter(parts[0], parseInt(parts[1], 10));
    }

    // Packets that travel along paths.
    var flyers = [];
    var fEls = root.querySelectorAll("[data-fly]");
    for (i = 0; i < fEls.length; i++) {
      flyers.push({
        el: fEls[i],
        path: q(fEls[i].getAttribute("data-fly")),
        fly: intList(fEls[i], "data-fly-steps"),
        rev: intList(fEls[i], "data-fly-reverse-steps"),
        park: intList(fEls[i], "data-park-steps"),
        delay: parseInt(fEls[i].getAttribute("data-fly-delay") || "0", 10),
        revDelay: parseInt(fEls[i].getAttribute("data-fly-reverse-delay") || "0", 10),
        arrive: fEls[i].getAttribute("data-fly-arrive"),
        revArrive: fEls[i].getAttribute("data-fly-reverse-arrive"),
      });
    }

    var cur = 0;
    var playing = false;
    var timer = null;
    var pending = []; // timeout / rAF ids for flight motion

    function cancelPending() {
      for (var i = 0; i < pending.length; i++) {
        window.clearTimeout(pending[i]);
        window.cancelAnimationFrame(pending[i]);
      }
      pending = [];
    }

    function park(f) {
      var pt = f.path.getPointAtLength(f.path.getTotalLength());
      f.el.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
      f.el.setAttribute("opacity", "1");
    }

    // Tween a flyer along its path; call its arrive counter when it lands.
    // A forward flight hides on arrival unless the flyer parks on this or a
    // later step. Reverse flights always hide on arrival.
    function fly(f, reverse, step) {
      var len = f.path.getTotalLength();
      var ms = reduced ? 0 : reverse ? f.revDelay : f.delay;
      var tid = window.setTimeout(function () {
        var start = null;
        var tick = function (ts) {
          if (start === null) start = ts;
          var t = Math.min(1, (ts - start) / FLY_MS);
          var eased = t * t * (3 - 2 * t);
          var dist = reverse ? len * (1 - eased) : len * eased;
          var pt = f.path.getPointAtLength(dist);
          f.el.setAttribute("opacity", "1");
          f.el.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ")");
          if (t < 1) {
            pending.push(window.requestAnimationFrame(tick));
          } else if (reverse) {
            f.el.setAttribute("opacity", "0");
            bumpCounter(f.revArrive);
          } else {
            bumpCounter(f.arrive);
            var stays = false;
            for (var p = 0; p < f.park.length; p++) {
              if (f.park[p] >= step) stays = true;
            }
            if (!stays) f.el.setAttribute("opacity", "0");
          }
        };
        pending.push(window.requestAnimationFrame(tick));
      }, ms);
      pending.push(tid);
    }

    var dots = [];
    for (var d = 0; d < N; d++) {
      (function (idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "player__dot";
        b.setAttribute("aria-label", "Step " + (idx + 1) + ": " + captions[idx].title);
        b.addEventListener("click", function () {
          go(idx);
        });
        dotsWrap.appendChild(b);
        dots.push(b);
      })(d);
    }

    function apply(i) {
      var step = i + 1;
      cur = i;
      for (var s = 1; s <= N; s++) root.classList.remove("player--s" + s);
      root.classList.add("player--s" + step);

      titleEl.textContent = captions[i].title;
      bodyEl.innerHTML = captions[i].html;

      for (var j = 0; j < N; j++) {
        dots[j].classList.toggle("on", j === i);
        dots[j].setAttribute("aria-selected", j === i ? "true" : "false");
      }
      countEl.textContent = step + " / " + N;
      progress.style.width = (step / N) * 100 + "%";
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === N - 1;

      for (var q = 0; q < lit.length; q++) {
        lit[q].el.classList.toggle("on", lit[q].steps.indexOf(step) >= 0);
      }

      for (var name in counters) {
        if (counters.hasOwnProperty(name)) {
          var c = counters[name];
          setCounter(name, c.steps[i] === undefined ? 0 : c.steps[i]);
        }
      }

      cancelPending();
      for (var f = 0; f < flyers.length; f++) {
        var fl = flyers[f];
        if (fl.fly.indexOf(step) >= 0) {
          fl.el.setAttribute("opacity", "0");
          fly(fl, false, step);
        } else if (fl.rev.indexOf(step) >= 0) {
          // Reverse flight departs from the path end: park it there first.
          if (fl.park.indexOf(step) >= 0) park(fl);
          else fl.el.setAttribute("opacity", "0");
          fly(fl, true, step);
        } else if (fl.park.indexOf(step) >= 0) {
          park(fl);
        } else {
          fl.el.setAttribute("opacity", "0");
        }
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
      root.classList.add("player--playing");
      playBtn.setAttribute("aria-label", "Pause");
      timer = window.setInterval(tickPlay, PLAY_MS);
    }

    function pause() {
      playing = false;
      root.classList.remove("player--playing");
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
  }

  var roots = document.querySelectorAll("[data-player]");
  for (var r = 0; r < roots.length; r++) {
    init(roots[r]);
  }
})();
