// Shared animation runner for the Shinzo docs.
//
// Mirrors the Mermaid loader pattern (templates/macros/mermaid.html): the
// `anim` macro (extra.anim = true) imports this module, which scans for
// [data-anim] containers and mounts the matching scene from
// /js/animations/<name>.js. Each scene exports mount(container, opts) and
// returns a controller { stepTo, next, prev, play, reset, setTheme, destroy,
// current, stageCount }.
//
// The runner owns: D3 loading (CDN ESM), the controls bar (play / prev / next
// / stage dots), autoplay-on-scroll, the prefers-reduced-motion fallback, and
// re-rendering when the light/dark theme changes.
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

function mountAll() {
  var containers = document.querySelectorAll('.anim-container[data-anim]');
  containers.forEach(function (container) {
    mountOne(container);
  });
}

async function mountOne(container) {
  var name = container.getAttribute('data-anim');
  if (!name) return;

  var mod;
  try {
    mod = await import('/js/animations/' + name + '.js');
  } catch (err) {
    console.error('[anim] failed to load scene "' + name + '"', err);
    return;
  }
  var mount = mod.mount || mod.default;
  if (typeof mount !== 'function') {
    console.error('[anim] scene "' + name + '" does not export mount()');
    return;
  }

  // onStageChange is called by the scene after each transition; it updates the
  // dots, the prev/next disabled state, and the play button label. It closes
  // over `controller`, which is assigned below — the scene never calls it
  // during initial mount, so there is no TDZ access.
  function onStageChange(i) {
    dotsHost.querySelectorAll('.anim-dot').forEach(function (dot, idx) {
      dot.classList.toggle('is-active', idx === i);
      dot.setAttribute('aria-selected', idx === i ? 'true' : 'false');
    });
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= controller.stageCount - 1;
    var atEnd = i >= controller.stageCount - 1;
    playLabel.textContent = atEnd ? 'Replay' : 'Play';
    playBtn.setAttribute('aria-label', atEnd ? 'Replay animation' : 'Play animation');
  }

  // Mount the scene first: it clears the container and appends its SVG +
  // caption. Only then do we append the controls bar (so it isn't wiped).
  var controller = mount(container, {
    d3: d3,
    isDark: isDark,
    reducedMotion: REDUCED,
    onStageChange: onStageChange,
  });

  // --- Controls bar ---
  var controls = document.createElement('div');
  controls.className = 'anim-controls';
  if (REDUCED) controls.classList.add('is-reduced');
  controls.innerHTML =
    '<button type="button" class="anim-btn anim-btn--play" aria-label="Play animation">' +
      '<span class="anim-play-icon" aria-hidden="true"></span>' +
      '<span class="anim-play-label">Play</span>' +
    '</button>' +
    '<button type="button" class="anim-btn anim-btn--prev" aria-label="Previous step" disabled>&#8249;</button>' +
    '<div class="anim-dots" role="tablist" aria-label="Animation stages"></div>' +
    '<button type="button" class="anim-btn anim-btn--next" aria-label="Next step">&#8250;</button>';
  container.appendChild(controls);

  var playBtn = controls.querySelector('.anim-btn--play');
  var playLabel = controls.querySelector('.anim-play-label');
  var prevBtn = controls.querySelector('.anim-btn--prev');
  var nextBtn = controls.querySelector('.anim-btn--next');
  var dotsHost = controls.querySelector('.anim-dots');

  for (var i = 0; i < controller.stageCount; i++) {
    (function (idx) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'anim-dot' + (idx === 0 ? ' is-active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      dot.setAttribute('aria-label', 'Go to stage ' + (idx + 1));
      dot.addEventListener('click', function () { controller.stepTo(idx, !REDUCED); });
      dotsHost.appendChild(dot);
    })(i);
  }

  playBtn.addEventListener('click', function () {
    if (controller.current >= controller.stageCount - 1) controller.reset();
    controller.play();
  });
  prevBtn.addEventListener('click', function () { controller.prev(!REDUCED); });
  nextBtn.addEventListener('click', function () { controller.next(!REDUCED); });

  // Sync controls to the scene's initial stage (stage 0).
  onStageChange(controller.current);

  // Autoplay once when the figure scrolls into view (disabled for reduced
  // motion; those users step with prev/next/dots instead).
  if (!REDUCED && 'IntersectionObserver' in window) {
    var played = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !played) {
          played = true;
          controller.play();
          io.disconnect();
        }
      });
    }, { threshold: 0.6 });
    io.observe(container);
  }

  // Re-render the scene in the newly active palette on theme toggle.
  window.addEventListener('themechange', function () {
    controller.setTheme(isDark);
  });
}

export { mountAll };
