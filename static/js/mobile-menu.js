// Mobile hamburger menu: toggles the slide-in navigation drawer so readers can
// navigate the site on small screens where the sidebar/topbar links are hidden.
(function () {
  var button = document.querySelector(".navbar__hamburger");
  var menu = document.getElementById("mobile-menu");
  var backdrop = document.querySelector(".mobile-menu-backdrop");
  if (!button || !menu || !backdrop) return;

  function open() {
    menu.hidden = false;
    backdrop.hidden = false;
    // Allow the element to be in the DOM before animating.
    window.requestAnimationFrame(function () {
      menu.classList.add("is-open");
      backdrop.classList.add("is-open");
    });
    button.classList.add("is-active");
    button.setAttribute("aria-expanded", "true");
    document.body.classList.add("mobile-menu-open");
  }

  function close() {
    menu.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    button.classList.remove("is-active");
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("mobile-menu-open");
    // Hide after the transition so it's not focusable while closed.
    window.setTimeout(function () {
      if (!menu.classList.contains("is-open")) {
        menu.hidden = true;
        backdrop.hidden = true;
      }
    }, 250);
  }

  function toggle() {
    if (button.getAttribute("aria-expanded") === "true") {
      close();
    } else {
      open();
    }
  }

  button.addEventListener("click", toggle);
  backdrop.addEventListener("click", close);

  // Close when a navigation link inside the drawer is clicked.
  menu.addEventListener("click", function (e) {
    var link = e.target.closest("a[href]");
    if (link) close();
  });

  // Close on Escape.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      close();
    }
  });

  // If the viewport grows past the mobile breakpoint, make sure the drawer is
  // closed and hidden.
  var mq = window.matchMedia("(min-width: 997px)");
  function handleMq() {
    if (mq.matches) close();
  }
  if (mq.addEventListener) {
    mq.addEventListener("change", handleMq);
  } else if (mq.addListener) {
    mq.addListener(handleMq);
  }
})();
