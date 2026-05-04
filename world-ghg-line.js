// ============================================================
//  World GHG Line + Stacked Area Chart + Choropleth Map — Section 1
//  Step 1: world total line chart
//  Step 2: stacked area by income group
//  Step 3: choropleth map colored by emissions and sorted by income group
// ============================================================
(function () {
  "use strict";

  const DATA_URL =
    "https://ourworldindata.org/grapher/total-ghg-emissions.csv?v=1&csvType=full&useColumnShortNames=true";

  const EMISSIONS_CSV = "assets/data/cumulative_emissions_2024.csv";

  const WORLD_TOPO_URL =
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

  // ISO numeric → ISO alpha-3 (covers all countries in our dataset)
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
    704:"VNM",887:"YEM",894:"ZMB",716:"ZWE",520:"NRU",570:"NIU",184:"COK",796:"TCA",
    862:"VEN",
  };

  const INCOME_GROUPS = [
    "Low-income countries",
    "Lower-middle-income countries",
    "Upper-middle-income countries",
    "High-income countries",
  ];

  const INCOME_COLORS_SVG = {
    "High-income countries":         "#c11c2a",
    "Upper-middle-income countries": "#e8695a",
    "Lower-middle-income countries": "#f4a97f",
    "Low-income countries":          "#fdd9b0",
  };

  const INCOME_LABELS = {
    "High-income countries":         "High income",
    "Upper-middle-income countries": "Upper-middle income",
    "Lower-middle-income countries": "Lower-middle income",
    "Low-income countries":          "Low income",
  };


  const INCOME_GROUP_LABELS = {
    "H":  "High income",
    "UM": "Upper-middle income",
    "LM": "Lower-middle income",
    "L":  "Low income",
  };

  const COLOR_NO_DATA = "#d0cdc8";

  const container = document.getElementById("world-ghg-line-chart");
  if (!container) return;

  const margin = { top: 48, right: 28, bottom: 52, left: 82 };

  let lineViewG, stackedViewG, titleEl, overlayEl;
  let currentView = "line";
  let pendingStep = null;
  let activeGroup = "all";   // map income-filter state, persists across rebuilds
  let stored      = null;    // holds all loaded data for rebuilds
  let resizeTimer = null;

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  window.GHGLineChart = {
    setStep: function (stepNum) {
      if (lineViewG) {
        applyStep(stepNum);
      } else {
        pendingStep = stepNum;
      }
    },
  };

  // ----------------------------------------------------------
  // Apply step: switch view + update title
  // ----------------------------------------------------------
  function applyStep(stepNum) {
    if (stepNum === 2) {
      switchView("stacked");
      titleEl.text("GHG Emissions by Income Group, 1850\u20132024");
    } else if (stepNum === 3) {
      switchView("map");
      titleEl.text("World Greenhouse Gas Emissions, 1850\u20132024");
    } else {
      switchView("line");
      titleEl.text("World Greenhouse Gas Emissions, 1850\u20132024");
    }
  }

  function switchView(view) {
    if (view === currentView) return;
    currentView = view;
    const dur = 550;

    lineViewG.transition().duration(dur)
      .style("opacity", view === "line" ? 1 : 0);
    stackedViewG.transition().duration(dur)
      .style("opacity", view === "stacked" ? 1 : 0);

    if (view === "map") {
      d3.select(overlayEl)
        .style("visibility", "visible").style("opacity", 0)
        .transition().duration(dur).style("opacity", 1);
    } else {
      d3.select(overlayEl).transition().duration(dur).style("opacity", 0)
        .on("end", function () { d3.select(overlayEl).style("visibility", "hidden"); });
    }
  }

  // Tear down and rebuild everything with fresh dimensions
  function rebuildAll() {
    if (!stored) return;
    d3.select(container).selectAll(".ghg-line-tooltip").remove();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    // buildChart removes existing SVGs internally
    buildChart(stored.worldData, stored.series, stored.pivoted);
    buildMap(stored.topoData, stored.emissionsData);
    switchView(currentView);
  }

  // Debounced ResizeObserver on the sticky container
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

  // ----------------------------------------------------------
  // Build choropleth map overlay — emissions scale + income filter
  // ----------------------------------------------------------
  function buildMap(topoData, emissionsData) {
    const W = container.clientWidth;
    const H = container.clientHeight;

    const mapDiv = document.createElement("div");
    mapDiv.className = "ghg-map-overlay";
    mapDiv.style.visibility = "hidden";
    mapDiv.style.opacity = "0";
    overlayEl = mapDiv;
    container.appendChild(mapDiv);

    // Lookup: ISO alpha-3 → row
    const lookup = new Map();
    emissionsData.forEach(function (d) {
      if (d.ISO) lookup.set(d.ISO, d);
    });

    // Emissions color scale: green → light yellow → dark red (log)
    const LEGEND_MIN = 1e8;    // 0.1 Bt
    const LEGEND_MAX = 6e11;   // 600 Bt
    const colorScale = d3.scaleSequentialLog(
      [LEGEND_MIN, LEGEND_MAX],
      function (t) {
        return t < 0.5
          ? d3.interpolateRgb("green", "#ffffbf")(t * 2)
          : d3.interpolateRgb("#ffffbf", "#c11c2a")((t - 0.5) * 2);
      }
    ).clamp(true);

    // activeGroup is module-level — persists across rebuilds

    // ── SVG ───────────────────────────────────────────────
    // Tighten vertical sections on tall (desktop) containers
    const tall     = H > 480;
    const TOP_PAD  = tall ? 10 : 8;
    const TITLE_H  = tall ? 18 : 22;
    const FILTER_H = tall ? 28 : 36;
    const LEGEND_H = tall ? 28 : 40;
    const SOURCE_H = tall ? 10 : 14;
    const PAD_X    = 14;

    const mapTop    = TOP_PAD + TITLE_H + FILTER_H + 4;
    const mapBottom = H - LEGEND_H - SOURCE_H - 4;

    const svg = d3.select(mapDiv).append("svg")
      .attr("width", W).attr("height", H);

    const countries = topojson.feature(topoData, topoData.objects.countries);
    const projection = d3.geoNaturalEarth1()
      .fitExtent([[PAD_X, mapTop], [W - PAD_X, mapBottom]], countries);
    const path = d3.geoPath().projection(projection);

    // Graticule (behind countries)
    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("class", "map-graticule")
      .attr("d", path);

    // Country fills
    function countryColor(d) {
      const iso3 = NUM_TO_ISO3[+d.id];
      const row  = iso3 ? lookup.get(iso3) : null;
      if (!row) return COLOR_NO_DATA;
      if (activeGroup !== "all" && row["Income Group"] !== activeGroup) return COLOR_NO_DATA;
      const em = +row.cumulative_emissions_2024;
      return em > 0 ? colorScale(em) : COLOR_NO_DATA;
    }

    const countryPaths = svg.append("g").attr("class", "map-countries")
      .selectAll("path")
      .data(countries.features)
      .join("path")
        .attr("class", "map-country")
        .attr("d", path)
        .attr("fill", countryColor);

    // Sphere outline (on top of countries)
    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("class", "map-sphere")
      .attr("d", path);

    // Title
    svg.append("text")
      .attr("class", "ghg-line-title")
      .attr("x", W / 2)
      .attr("y", TOP_PAD + TITLE_H - 4)
      .attr("text-anchor", "middle")
      .text("Cumulative GHG Emissions by Country, 1850-2024");

    // ── Gradient legend ───────────────────────────────────
    const barW  = Math.min(200, W * 0.35);
    const barH  = 10;
    const barX  = PAD_X + 32;
    const barY  = H - SOURCE_H - barH - (tall ? 10 : 18);

    const gradId = "ghg-em-grad";
    const grad = svg.append("defs").append("linearGradient")
      .attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
    for (let i = 0; i <= 20; i++) {
      const t  = i / 20;
      const em = Math.pow(10, Math.log10(LEGEND_MIN) + t * (Math.log10(LEGEND_MAX) - Math.log10(LEGEND_MIN)));
      grad.append("stop")
        .attr("offset", (t * 100) + "%")
        .attr("stop-color", colorScale(em));
    }

    svg.append("text").attr("class", "ghg-legend-text")
      .attr("x", barX - 4).attr("y", barY + barH)
      .attr("text-anchor", "end").text("0.1 Bt");

    svg.append("rect")
      .attr("x", barX).attr("y", barY)
      .attr("width", barW).attr("height", barH)
      .attr("fill", "url(#" + gradId + ")");

    svg.append("text").attr("class", "ghg-legend-text")
      .attr("x", barX + barW + 4).attr("y", barY + barH)
      .attr("text-anchor", "start").text("600 Bt");

    // Tick marks: 1, 10, 100, 500 Bt
    function logPos(v) {
      return (Math.log10(v) - Math.log10(LEGEND_MIN)) /
             (Math.log10(LEGEND_MAX) - Math.log10(LEGEND_MIN)) * barW;
    }
    function fmtTick(v) {
      return d3.format(".1~f")(v / 1e9) + " Bt";
    }
    [1e9, 1e10, 1e11, 5e11].forEach(function (v) {
      const tx = barX + logPos(v);
      svg.append("line")
        .attr("x1", tx).attr("x2", tx)
        .attr("y1", barY + barH).attr("y2", barY + barH + 4)
        .attr("stroke", "#888").attr("stroke-width", 0.8);
      svg.append("text").attr("class", "ghg-legend-text")
        .attr("x", tx).attr("y", barY + barH + 13)
        .attr("text-anchor", "middle").text(fmtTick(v));
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
    const sourceText = svg.append("text").attr("class", "ghg-line-source")
      .attr("x", W - PAD_X).attr("y", H - 4)
      .attr("text-anchor", "end");
    sourceText.append("a")
      .attr("href", "https://ourworldindata.org/grapher/cumulative-co2-including-land")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("tspan").text("Source: Our World in Data");
    sourceText.append("tspan").text(" / ");
    sourceText.append("a")
      .attr("href", "https://datahelpdesk.worldbank.org/knowledgebase/articles/906519-world-bank-country-and-lending-groups")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("tspan").text("World Bank");

    // ── Tooltip ───────────────────────────────────────────
    const tooltip = d3.select(container)
      .append("div")
      .attr("class", "ghg-line-tooltip")
      .style("display", "none");

    countryPaths
      .on("mousemove", function (event, d) {
        if (currentView !== "map") return;
        const iso3 = NUM_TO_ISO3[+d.id];
        const row  = iso3 ? lookup.get(iso3) : null;
        const name = row ? row.Country_x : (iso3 || "Unknown");
        const grp  = row && row["Income Group"]
          ? INCOME_GROUP_LABELS[row["Income Group"]] : "No income data";
        const em   = row ? +row.cumulative_emissions_2024 : 0;
        const emTxt = em > 0
          ? d3.format("d")(em / 1e9) + " BtCO\u2082e cumulative" : "\u2014";

        const [mx, my] = d3.pointer(event, container);
        const flip = mx > W / 2;
        tooltip.style("display", "block")
          .html("<strong>" + name + "</strong><br>" + grp + "<br>" + emTxt)
          .style("left",  flip ? "auto"              : (mx + 12) + "px")
          .style("right", flip ? (W - mx + 12) + "px" : "auto")
          .style("top",   (my - 12) + "px");
      })
      .on("mouseleave", function () { tooltip.style("display", "none"); });

    // ── Filter buttons (HTML, appended last so they sit on top) ──
    const filtersDiv = document.createElement("div");
    filtersDiv.className = "ghg-map-filters";
    filtersDiv.style.top = (TOP_PAD + TITLE_H + 4) + "px";

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
        countryPaths.attr("fill", countryColor);
      });
      filtersDiv.appendChild(btn);
    });
    mapDiv.appendChild(filtersDiv);
  }

  // ----------------------------------------------------------
  // Build SVG line + stacked area chart
  // ----------------------------------------------------------
  function buildChart(worldData, series, pivoted) {
    const W = container.clientWidth;
    const H = container.clientHeight;
    const w = W - margin.left - margin.right;
    const h = H - margin.top  - margin.bottom;

    d3.select(container).selectAll("svg").remove();

    const svg = d3.select(container)
      .append("svg")
      .attr("width", W)
      .attr("height", H);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Shared x scale
    const x = d3.scaleLinear()
      .domain(d3.extent(worldData, (d) => d.year))
      .range([0, w]);

    // y domain covers world total and stacked max
    const yMax = Math.max(
      d3.max(worldData,  (d) => d.emissions),
      series.length ? d3.max(series, (s) => d3.max(s, (d) => d[1])) : 0
    );
    const y = d3.scaleLinear()
      .domain([0, yMax]).nice()
      .range([h, 0]);

    // Grid
    g.append("g").attr("class", "ghg-line-grid")
      .call(d3.axisLeft(y).tickSize(-w).tickFormat("").ticks(5));

    // X axis
    g.append("g").attr("class", "ghg-line-axis")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(7));

    // Y axis
    g.append("g").attr("class", "ghg-line-axis")
      .call(d3.axisLeft(y).ticks(5)
        .tickFormat((d) => `${d3.format(".0f")(d)}`));

    // Y-axis label
    g.append("text")
      .attr("class", "ghg-line-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(h / 2))
      .attr("y", -margin.left + 22)
      .attr("text-anchor", "middle")
      .text("Billion tonnes CO\u2082e / year");

    // Title
    titleEl = g.append("text")
      .attr("class", "ghg-line-title")
      .attr("x", w / 2)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .text("World Greenhouse Gas Emissions, 1850\u20132024");

    // Source note
    svg.append("a")
      .attr("href", "https://ourworldindata.org/grapher/total-ghg-emissions")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("text")
      .attr("class", "ghg-line-source")
      .attr("x", W - margin.right)
      .attr("y", H - 6)
      .attr("text-anchor", "end")
      .text("Source: Our World in Data");

    // ── LINE VIEW ─────────────────────────────────────────
    lineViewG = g.append("g").attr("class", "view-line");

    lineViewG.append("path")
      .datum(worldData)
      .attr("class", "ghg-line-area")
      .attr("d", d3.area()
        .x((d) => x(d.year)).y0(h).y1((d) => y(d.emissions))
        .curve(d3.curveMonotoneX));

    lineViewG.append("path")
      .datum(worldData)
      .attr("class", "ghg-line-path")
      .attr("d", d3.line()
        .x((d) => x(d.year)).y((d) => y(d.emissions))
        .curve(d3.curveMonotoneX));

    // ── STACKED VIEW ──────────────────────────────────────
    stackedViewG = g.append("g")
      .attr("class", "view-stacked")
      .style("opacity", 0);

    if (series.length) {
      const stackArea = d3.area()
        .x((d) => x(d.data.year))
        .y0((d) => y(d[0]))
        .y1((d) => y(d[1]))
        .curve(d3.curveMonotoneX);

      stackedViewG.selectAll(".stack-layer")
        .data(series)
        .join("path")
        .attr("class", "stack-layer")
        .attr("fill", (d) => INCOME_COLORS_SVG[d.key])
        .attr("d", stackArea);

      // Legend
      const legendG = stackedViewG.append("g")
        .attr("class", "ghg-stack-legend")
        .attr("transform", "translate(12, 8)");

      [...INCOME_GROUPS].reverse().forEach(function (key, i) {
        const row = legendG.append("g")
          .attr("transform", `translate(0, ${i * 20})`);
        row.append("rect")
          .attr("width", 11).attr("height", 11)
          .attr("fill", INCOME_COLORS_SVG[key]);
        row.append("text")
          .attr("x", 15).attr("y", 9)
          .attr("class", "ghg-legend-text")
          .text(INCOME_LABELS[key]);
      });
    }

    // ── TOOLTIP + FOCUS ───────────────────────────────────
    const tooltip = d3.select(container)
      .append("div")
      .attr("class", "ghg-line-tooltip")
      .style("display", "none");

    const bisect      = d3.bisector((d) => d.year).left;
    const bisectStack = d3.bisector((d) => d.year).left;

    const focus = g.append("g")
      .attr("class", "ghg-line-focus").style("display", "none");
    focus.append("circle").attr("r", 5);
    focus.append("line").attr("class", "ghg-focus-line")
      .attr("y1", 0).attr("y2", h);

    svg.append("rect")
      .attr("class", "ghg-line-overlay")
      .attr("x", margin.left).attr("y", margin.top)
      .attr("width", w).attr("height", h)
      .on("mousemove", function (event) {
        if (currentView === "map") return;
        const [mx] = d3.pointer(event, this);
        const xVal = x.invert(mx - margin.left);
        const TW   = w + margin.left + margin.right;

        function positionTooltip(tt, cx, cy) {
          const flip = cx > w / 2 + margin.left;
          tt.style("left",  flip ? "auto"              : `${cx + 14}px`)
            .style("right", flip ? `${TW - cx + 14}px` : "auto")
            .style("top",   `${cy - 20}px`);
        }

        if (currentView === "line") {
          const idx = bisect(worldData, xVal, 1);
          const d0  = worldData[idx - 1];
          const d1  = worldData[idx] || d0;
          const d   = xVal - d0.year < d1.year - xVal ? d0 : d1;

          focus.style("display", null)
            .attr("transform", `translate(${x(d.year)},${y(d.emissions)})`);
          focus.select(".ghg-focus-line").attr("y2", h - y(d.emissions));

          positionTooltip(
            tooltip.style("display", "block")
              .html(`<strong>${d.year}</strong><br>${d3.format(".2f")(d.emissions)} BtCO\u2082e`),
            x(d.year) + margin.left,
            y(d.emissions) + margin.top
          );

        } else if (pivoted.length) {
          const idx = bisectStack(pivoted, xVal, 1);
          const d0  = pivoted[idx - 1];
          const d1  = pivoted[idx] || d0;
          const d   = xVal - d0.year < d1.year - xVal ? d0 : d1;

          const total = INCOME_GROUPS.reduce((s, k) => s + (d[k] || 0), 0);

          focus.style("display", null)
            .attr("transform", `translate(${x(d.year)},${y(total)})`);
          focus.select(".ghg-focus-line").attr("y2", h - y(total));

          const rows = [...INCOME_GROUPS].reverse()
            .map((k) =>
              `<span style="color:${INCOME_COLORS_SVG[k]}">&#9632;</span> ` +
              `${INCOME_LABELS[k]}: ${d3.format(".2f")(d[k] || 0)}`)
            .join("<br>");

          positionTooltip(
            tooltip.style("display", "block")
              .html(`<strong>${d.year}</strong><br>${rows}`),
            x(d.year) + margin.left,
            y(total) + margin.top
          );
        }
      })
      .on("mouseleave", function () {
        focus.style("display", "none");
        tooltip.style("display", "none");
      });

    // Replay any step that arrived before the chart was ready
    if (pendingStep !== null) {
      applyStep(pendingStep);
      pendingStep = null;
    }
  }

  // ----------------------------------------------------------
  // Retry until container has dimensions
  // ----------------------------------------------------------
  function attemptBuild(worldData, series, pivoted, topoData, emissionsData) {
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W > 0 && H > 0) {
      stored = { worldData, series, pivoted, topoData, emissionsData };
      buildChart(worldData, series, pivoted);
      buildMap(topoData, emissionsData);
      setupResizeObserver();
    } else {
      requestAnimationFrame(function () {
        attemptBuild(worldData, series, pivoted, topoData, emissionsData);
      });
    }
  }

  // ----------------------------------------------------------
  // Load & process
  // ----------------------------------------------------------
  Promise.all([
    d3.csv(DATA_URL, function (d) {
      return {
        entity:    d.entity,
        year:      +d.year,
        emissions: +d.annual_emissions_ghg_total_co2eq / 1e9,
      };
    }),
    d3.csv(EMISSIONS_CSV),
    d3.json(WORLD_TOPO_URL),
  ]).then(function ([data, emissionsData, topoData]) {
    const worldData = data
      .filter((d) => d.entity === "World")
      .sort((a, b) => a.year - b.year);

    // Pivot income rows into { year, groupName: val, … }
    const incomeRows = data.filter((d) => INCOME_GROUPS.includes(d.entity));
    const yearMap = new Map();
    incomeRows.forEach(function (d) {
      if (!yearMap.has(d.year)) yearMap.set(d.year, { year: d.year });
      yearMap.get(d.year)[d.entity] = d.emissions;
    });
    const pivoted = Array.from(yearMap.values())
      .filter((d) => INCOME_GROUPS.every((key) => d[key] !== undefined))
      .sort((a, b) => a.year - b.year);

    let series = [];
    if (pivoted.length) {
      series = d3.stack()
        .keys(INCOME_GROUPS)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone)(pivoted);
    } else {
      console.warn("GHG chart: no income-group rows matched. Check entity names.");
    }

    if (!worldData.length) {
      console.warn("GHG chart: no 'World' rows found.");
      return;
    }

    attemptBuild(worldData, series, pivoted, topoData, emissionsData);
  }).catch(function (err) {
    console.error("GHG chart failed to load data:", err);
  });
})();
