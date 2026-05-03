// ============================================================
//  Section 2 Map — Vulnerability / Readiness / ND-GAIN
//  Step 1: Vulnerability Index 2023  (white → red)
//  Step 2: Readiness Index 2023      (white → green)
//  Step 3: ND-GAIN Score 2023        (red → yellow → green)
// ============================================================
(function () {
  "use strict";

  const VULN_CSV       = "assets/data/vulnerability.csv";
  const READ_CSV       = "assets/data/readiness.csv";
  const GAIN_CSV       = "assets/data/gain_income_iso.csv";
  const WORLD_TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

  // ISO numeric → ISO alpha-3
  const NUM_TO_ISO3 = {
    4:"AFG",8:"ALB",12:"DZA",20:"AND",24:"AGO",28:"ATG",32:"ARG",51:"ARM",533:"ABW",
    36:"AUS",40:"AUT",31:"AZE",44:"BHS",48:"BHR",50:"BGD",52:"BRB",112:"BLR",56:"BEL",
    84:"BLZ",204:"BEN",64:"BTN",68:"BOL",70:"BIH",72:"BWA",76:"BRA",92:"VGB",96:"BRN",
    100:"BGR",854:"BFA",108:"BDI",116:"KHM",120:"CMR",124:"CAN",132:"CPV",140:"CAF",148:"TCD",
    152:"CHL",156:"CHN",170:"COL",174:"COM",178:"COG",188:"CRI",384:"CIV",191:"HRV",192:"CUB",
    196:"CYP",203:"CZE",180:"COD",208:"DNK",262:"DJI",212:"DMA",214:"DOM",626:"TLS",218:"ECU",
    818:"EGY",222:"SLV",226:"GNQ",232:"ERI",233:"EST",748:"SWZ",231:"ETH",242:"FJI",246:"FIN",
    250:"FRA",266:"GAB",270:"GMB",268:"GEO",276:"DEU",288:"GHA",300:"GRC",308:"GRD",320:"GTM",
    324:"GIN",624:"GNB",328:"GUY",332:"HTI",340:"HND",344:"HKG",348:"HUN",352:"ISL",356:"IND",
    360:"IDN",364:"IRN",368:"IRQ",372:"IRL",376:"ISR",380:"ITA",388:"JAM",392:"JPN",400:"JOR",
    398:"KAZ",404:"KEN",296:"KIR",414:"KWT",417:"KGZ",418:"LAO",428:"LVA",422:"LBN",426:"LSO",
    430:"LBR",434:"LBY",438:"LIE",440:"LTU",442:"LUX",446:"MAC",450:"MDG",454:"MWI",458:"MYS",
    462:"MDV",466:"MLI",470:"MLT",478:"MRT",480:"MUS",484:"MEX",583:"FSM",498:"MDA",496:"MNG",
    499:"MNE",504:"MAR",508:"MOZ",104:"MMR",516:"NAM",524:"NPL",528:"NLD",554:"NZL",558:"NIC",
    562:"NER",566:"NGA",408:"PRK",807:"MKD",578:"NOR",512:"OMN",586:"PAK",585:"PLW",591:"PAN",
    598:"PNG",600:"PRY",604:"PER",608:"PHL",616:"POL",620:"PRT",634:"QAT",642:"ROU",643:"RUS",
    646:"RWA",659:"KNA",662:"LCA",670:"VCT",882:"WSM",678:"STP",682:"SAU",686:"SEN",688:"SRB",
    690:"SYC",694:"SLE",702:"SGP",703:"SVK",705:"SVN",90:"SLB",706:"SOM",710:"ZAF",410:"KOR",
    728:"SSD",724:"ESP",144:"LKA",729:"SDN",740:"SUR",752:"SWE",756:"CHE",760:"SYR",158:"TWN",
    762:"TJK",834:"TZA",764:"THA",768:"TGO",776:"TON",780:"TTO",788:"TUN",792:"TUR",795:"TKM",
    798:"TUV",800:"UGA",804:"UKR",784:"ARE",826:"GBR",840:"USA",858:"URY",860:"UZB",548:"VUT",
    704:"VNM",887:"YEM",894:"ZMB",716:"ZWE",520:"NRU",570:"NIU",184:"COK",796:"TCA",862:"VEN",
  };

  const INCOME_GROUP_LABELS = {
    "H":  "High income",
    "UM": "Upper-middle income",
    "LM": "Lower-middle income",
    "L":  "Low income",
  };

  const COLOR_NO_DATA = "#d0cdc8";

  // ── View definitions ──────────────────────────────────────
  // Values in vuln/readiness CSVs are 0–1; multiply by 100 for display.
  // gain values are already 0–100.
  const VIEWS = {
    1: {
      dataKey:     "vuln",
      scale:       100,                 // multiply raw value by this
      colorScale:  d3.scaleSequential([0, 100], d3.interpolateRgb("#ffffbf", "red")).clamp(true),
      gradId:      "gain-vuln-grad",
      title:       "ND-GAIN Vulnerability Index, 2023",
      tooltipLabel: "Vulnerability",
    },
    2: {
      dataKey:     "read",
      scale:       100,
      colorScale:  d3.scaleSequential([0, 100], d3.interpolateRgb("#ffffbf", "green")).clamp(true),
      gradId:      "gain-read-grad",
      title:       "ND-GAIN Readiness Index 2023",
      tooltipLabel: "Readiness",
    },
    3: {
      dataKey:     "gain",
      scale:       1,                   // already 0–100
      colorScale:  d3.scaleSequential([0, 100], d3.interpolateRdYlGn).clamp(true),
      gradId:      "gain-score-grad",
      title:       "ND-GAIN Country Index, 2023",
      tooltipLabel: "Score",
    },
  };

  const container = document.getElementById("gain-map");
  if (!container) return;

  let activeGroup  = "all";
  let currentStep  = 1;
  let pendingStep  = null;
  let stored       = null;
  let svgState     = null;
  let resizeTimer  = null;

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  window.GAINMap = {
    setStep: function (stepNum) {
      currentStep = stepNum;
      if (svgState) {
        applyStep(stepNum, true);
      } else {
        pendingStep = stepNum;
      }
    },
  };

  // ----------------------------------------------------------
  // Apply a step: transition fills + update title & legend
  // ----------------------------------------------------------
  function applyStep(stepNum, animate) {
    const view = VIEWS[stepNum] || VIEWS[1];
    const dur  = animate ? 500 : 0;

    // Country fills
    svgState.countryPaths
      .transition().duration(dur)
      .attr("fill", function (d) { return countryColor(d, view); });

    // Title
    svgState.titleEl.text(view.title);

    // Legend gradient: swap which gradient the bar references
    svgState.legendRect.attr("fill", "url(#" + view.gradId + ")");

    // Tooltip uses current view — stored on svgState for mousemove
    svgState.currentView = view;
  }

  // Return the fill color for a country path given a view config
  function countryColor(d, view) {
    const iso3 = NUM_TO_ISO3[+d.id];
    const row  = iso3 ? stored.lookup.get(iso3) : null;
    if (!row) return COLOR_NO_DATA;
    if (activeGroup !== "all" && row.incomeGroup !== activeGroup) return COLOR_NO_DATA;
    const raw = row[view.dataKey];
    if (raw === null || raw === undefined || isNaN(raw)) return COLOR_NO_DATA;
    return view.colorScale(raw * view.scale);
  }

  // ----------------------------------------------------------
  // Build map (called once, and again on resize)
  // ----------------------------------------------------------
  function buildMap(topoData, lookup) {
    d3.select(container).selectAll("*").remove();
    svgState = null;

    const W = container.clientWidth;
    const H = container.clientHeight;

    const tall     = H > 480;
    const TITLE_H  = tall ? 18 : 22;
    const FILTER_H = tall ? 28 : 36;
    const LEGEND_H = tall ? 28 : 40;
    const SOURCE_H = tall ? 10 : 14;
    const PAD_X    = 14;

    const mapTop    = TITLE_H + FILTER_H + 4;
    const mapBottom = H - LEGEND_H - SOURCE_H - 4;

    const svg = d3.select(container).append("svg")
      .attr("width", W).attr("height", H);

    // ── Pre-define all three gradients ────────────────────
    const defs = svg.append("defs");
    Object.values(VIEWS).forEach(function (view) {
      const grad = defs.append("linearGradient")
        .attr("id", view.gradId)
        .attr("x1", "0%").attr("x2", "100%");
      for (let i = 0; i <= 20; i++) {
        grad.append("stop")
          .attr("offset", (i * 5) + "%")
          .attr("stop-color", view.colorScale(i * 5));
      }
    });

    // ── Projection & path ─────────────────────────────────
    const countries = topojson.feature(topoData, topoData.objects.countries);
    const projection = d3.geoNaturalEarth1()
      .fitExtent([[PAD_X, mapTop], [W - PAD_X, mapBottom]], countries);
    const path = d3.geoPath().projection(projection);

    // Graticule
    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("class", "map-graticule")
      .attr("d", path);

    // Country fills — rendered in current step's view immediately
    const view0 = VIEWS[currentStep] || VIEWS[1];
    const countryPaths = svg.append("g").attr("class", "map-countries")
      .selectAll("path")
      .data(countries.features)
      .join("path")
        .attr("class", "map-country")
        .attr("d", path)
        .attr("fill", function (d) { return countryColor(d, view0); });

    // Sphere outline
    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("class", "map-sphere")
      .attr("d", path);

    // ── Title ─────────────────────────────────────────────
    const titleEl = svg.append("text")
      .attr("class", "ghg-line-title")
      .attr("x", W / 2)
      .attr("y", TITLE_H - 4)
      .attr("text-anchor", "middle")
      .text(view0.title);

    // ── Legend ────────────────────────────────────────────
    const barW = Math.min(200, W * 0.35);
    const barH = 10;
    const barX = PAD_X + 32;
    const barY = H - SOURCE_H - barH - (tall ? 10 : 18);

    svg.append("text").attr("class", "ghg-legend-text")
      .attr("x", barX - 4).attr("y", barY + barH)
      .attr("text-anchor", "end").text("0");

    const legendRect = svg.append("rect")
      .attr("x", barX).attr("y", barY)
      .attr("width", barW).attr("height", barH)
      .attr("fill", "url(#" + view0.gradId + ")");

    svg.append("text").attr("class", "ghg-legend-text")
      .attr("x", barX + barW + 4).attr("y", barY + barH)
      .attr("text-anchor", "start").text("100");

    // Tick marks at 25, 50, 75
    [25, 50, 75].forEach(function (v) {
      const tx = barX + (v / 100) * barW;
      svg.append("line")
        .attr("x1", tx).attr("x2", tx)
        .attr("y1", barY + barH).attr("y2", barY + barH + 4)
        .attr("stroke", "#888").attr("stroke-width", 0.8);
      svg.append("text").attr("class", "ghg-legend-text")
        .attr("x", tx).attr("y", barY + barH + 13)
        .attr("text-anchor", "middle").text(v);
    });

    // No-data swatch
    const ndX = barX + barW + 56;
    svg.append("rect")
      .attr("x", ndX).attr("y", barY)
      .attr("width", 10).attr("height", barH)
      .attr("fill", COLOR_NO_DATA);
    svg.append("text").attr("class", "ghg-legend-text")
      .attr("x", ndX + 14).attr("y", barY + barH)
      .text("No data");

    // Source
    svg.append("a")
      .attr("href", "https://gain.nd.edu/our-work/country-index/")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("text").attr("class", "ghg-line-source")
      .attr("x", W - PAD_X).attr("y", H - 4)
      .attr("text-anchor", "end")
      .text("Source: ND-GAIN Country Index");

    // ── Tooltip ───────────────────────────────────────────
    const tooltip = d3.select(container)
      .append("div")
      .attr("class", "ghg-line-tooltip")
      .style("display", "none");

    countryPaths
      .on("mousemove", function (event, d) {
        const view = svgState ? svgState.currentView : view0;
        const iso3 = NUM_TO_ISO3[+d.id];
        const row  = iso3 ? lookup.get(iso3) : null;
        const name = row ? row.country : (iso3 || "Unknown");
        const grp  = row && row.incomeGroup
          ? INCOME_GROUP_LABELS[row.incomeGroup] : "No income data";
        const raw  = row ? row[view.dataKey] : null;
        const val  = (raw !== null && raw !== undefined && !isNaN(raw))
          ? d3.format(".1f")(raw * view.scale) : "\u2014";

        const [mx, my] = d3.pointer(event, container);
        const flip = mx > W / 2;
        tooltip.style("display", "block")
          .html("<strong>" + name + "</strong><br>" + grp +
                "<br>" + view.tooltipLabel + ": " + val)
          .style("left",  flip ? "auto"              : (mx + 12) + "px")
          .style("right", flip ? (W - mx + 12) + "px" : "auto")
          .style("top",   (my - 12) + "px");
      })
      .on("mouseleave", function () { tooltip.style("display", "none"); });

    // ── Filter buttons ────────────────────────────────────
    const filtersDiv = document.createElement("div");
    filtersDiv.className = "ghg-map-filters";
    filtersDiv.style.top = (TITLE_H + 4) + "px";

    [
      { key: "all", label: "All countries" },
      { key: "H",   label: "High income"   },
      { key: "UM",  label: "Upper-middle"  },
      { key: "LM",  label: "Lower-middle"  },
      { key: "L",   label: "Low income"    },
    ].forEach(function (g) {
      const btn = document.createElement("button");
      btn.className = "ghg-map-filter-btn" + (g.key === activeGroup ? " is-active" : "");
      btn.dataset.group = g.key;
      btn.textContent = g.label;
      btn.addEventListener("click", function () {
        if (activeGroup === g.key) return;
        activeGroup = g.key;
        filtersDiv.querySelectorAll(".ghg-map-filter-btn").forEach(function (b) {
          b.classList.toggle("is-active", b.dataset.group === g.key);
        });
        // Redraw with current view
        const view = svgState ? svgState.currentView : view0;
        countryPaths.attr("fill", function (d) { return countryColor(d, view); });
      });
      filtersDiv.appendChild(btn);
    });
    container.appendChild(filtersDiv);

    // ── Store live references ─────────────────────────────
    svgState = { countryPaths, titleEl, legendRect, currentView: view0 };

    // Replay a step that arrived before the map was ready
    if (pendingStep !== null) {
      applyStep(pendingStep, false);
      pendingStep = null;
    }
  }

  // ----------------------------------------------------------
  // Resize handling
  // ----------------------------------------------------------
  function rebuildAll() {
    if (!stored) return;
    buildMap(stored.topoData, stored.lookup);
  }

  function setupResizeObserver() {
    const handler = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuildAll, 200);
    };
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(handler).observe(container);
    } else {
      window.addEventListener("resize", handler, { passive: true });
    }
  }

  function attemptBuild(topoData, lookup) {
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W > 0 && H > 0) {
      stored = { topoData, lookup };
      buildMap(topoData, lookup);
      setupResizeObserver();
    } else {
      requestAnimationFrame(function () {
        attemptBuild(topoData, lookup);
      });
    }
  }

  // ----------------------------------------------------------
  // Load data & build unified lookup
  // ----------------------------------------------------------
  Promise.all([
    d3.json(WORLD_TOPO_URL),
    d3.csv(VULN_CSV),
    d3.csv(READ_CSV),
    d3.csv(GAIN_CSV),
  ]).then(function ([topoData, vulnData, readData, gainData]) {
    // Build a single lookup: ISO3 → { country, incomeGroup, vuln, read, gain }
    const lookup = new Map();

    function ensureRow(iso, country, incomeGroup) {
      if (!lookup.has(iso)) {
        lookup.set(iso, { country: country, incomeGroup: incomeGroup,
                          vuln: null, read: null, gain: null });
      }
      // Fill in missing metadata from later sources
      const r = lookup.get(iso);
      if (!r.country     && country)      r.country = country;
      if (!r.incomeGroup && incomeGroup)  r.incomeGroup = incomeGroup;
      return r;
    }

    vulnData.forEach(function (d) {
      if (!d.ISO) return;
      const r = ensureRow(d.ISO, d.Country, d["Income Group"]);
      const v = parseFloat(d["2023"]);
      r.vuln = isNaN(v) ? null : v;
    });

    readData.forEach(function (d) {
      if (!d.ISO) return;
      const r = ensureRow(d.ISO, d.Country, d["Income Group"]);
      const v = parseFloat(d["2023"]);
      r.read = isNaN(v) ? null : v;
    });

    gainData.forEach(function (d) {
      if (!d.ISO) return;
      const r = ensureRow(d.ISO, d.Country, d["Income Group"]);
      const v = parseFloat(d["2023_gain"]);
      r.gain = isNaN(v) ? null : v;  // stored as 0–100; VIEWS[3].scale = 1
    });

    attemptBuild(topoData, lookup);
  }).catch(function (err) {
    console.error("Section 2 map failed to load:", err);
  });

})();
