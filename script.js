// ============================================================
//  Climate Finance — Scrollytelling Script
//  Uses: Scrollama 3.x, D3 v7
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // 1. Progress bar + nav link highlighting on scroll
  // ----------------------------------------------------------
  const progressBar = document.getElementById("progress-bar");
  const navLinks = document.querySelectorAll(".nav-link");

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + "%";
  }

  function updateActiveNavLink() {
    const scrollMid = window.scrollY + window.innerHeight / 2;

    // Walk sections in reverse so the last one above midpoint wins
    let activeId = null;
    document.querySelectorAll("section[id]").forEach((sec) => {
      if (sec.offsetTop <= scrollMid) activeId = sec.id;
    });

    navLinks.forEach((link) => {
      const isActive = link.dataset.section === activeId;
      link.classList.toggle("active", isActive);
    });
  }

  window.addEventListener("scroll", () => {
    updateProgress();
    updateActiveNavLink();
  }, { passive: true });

  // Run once on load
  updateProgress();
  updateActiveNavLink();

  // ----------------------------------------------------------
  // 2. Scrollama — one instance per section
  // ----------------------------------------------------------

  // Helper: swap visible step annotation
  function handleStepEnter(response) {
    const { element } = response;

    // Deactivate siblings
    element.parentElement.querySelectorAll(".step").forEach((s) => {
      s.classList.remove("is-active");
    });
    element.classList.add("is-active");

    // Determine which section this step belongs to
    const stepId = element.dataset.step;          // e.g. "2-3"
    const sectionNum = stepId.split("-")[0];       // e.g. "2"
    const stepNum = parseInt(stepId.split("-")[1], 10);

    // Trigger the appropriate map update
    updateMap(sectionNum, stepNum);
  }

  function handleStepExit(response) {
    response.element.classList.remove("is-active");
  }

  // Offset: on desktop the map sits beside the text so the mid-screen trigger
  // (0.55) works well. On tablet/phone the map pins to the top ~45–55 vh, so
  // the visible text area starts lower — use 0.65 to fire when the step enters
  // the readable zone beneath the map.
  function scrollamaOffset() {
    return window.innerWidth < 1024 ? 0.65 : 0.55;
  }

  // Initialise a scroller for each section; keep references for resize/destroy
  const scrollers = ["1", "2", "3"].map((num) => {
    const scroller = scrollama();
    scroller
      .setup({
        step: `#steps-${num} .step`,
        offset: scrollamaOffset,   // function — re-evaluated on each step check
        debug: false,
      })
      .onStepEnter(handleStepEnter)
      .onStepExit(handleStepExit);
    return scroller;
  });

  // Recalculate step positions on window resize
  window.addEventListener("resize", () => {
    scrollers.forEach((s) => s.resize());
  }, { passive: true });

  // Orientation change can alter viewport dimensions significantly
  window.addEventListener("orientationchange", () => {
    setTimeout(() => scrollers.forEach((s) => s.resize()), 200);
  }, { passive: true });

  // ----------------------------------------------------------
  // 3. Map update hooks  (replace with real map logic later)
  // ----------------------------------------------------------

  /**
   * Called every time a new step becomes active.
   * @param {string} sectionNum  "1" | "2" | "3"
   * @param {number} stepNum     1 | 2 | 3
   */
  function updateMap(sectionNum, stepNum) {
    const mapEl = document.getElementById(`map-${sectionNum}`);
    if (!mapEl) return;

    // Placeholder: just update the label so you can see it working
    const note = mapEl.querySelector(".map-note");
    if (note) {
      note.textContent = `Step ${sectionNum}-${stepNum} active — update map here`;
    }

    // TODO: replace this block with real D3 / Mapbox / Leaflet logic, e.g.:
    // if (sectionNum === "1") {
    //   if (stepNum === 1) { /* zoom to region A */ }
    //   if (stepNum === 2) { /* highlight layer B */ }
    // }
  }

})();
