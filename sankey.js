// ============================================================
//  Section 3 Sankey — Global Climate Finance Flows
//  Layers: Development_Status_Origin → Use →
//          Development_Status_Destination
//  Region multiselect dropdown filters flows by destination.
//  Flow colors follow the Use category.
//  Data: assets/data/CPI_finance.csv (values in USD billions)
// ============================================================
(function () {
  "use strict";

  const CSV_URL = "assets/data/CPI_finance.csv";
  const container = document.getElementById("sankey-chart");
  if (!container) return;

  const FONT = "Franklin Gothic Medium, Arial Narrow, Arial, sans-serif";

  // ── Color palette ─────────────────────────────────────────
  const STATUS_COLORS = {
    "Advanced":      "#c11c2a",
    "China":         "#e8695a",
    "EMDE":          "#f4a97f",
    "LDC":           "#fdd9b0",
    "Transregional": "#bbb0a8",
    "Unknown":       "#d0cdc8",
  };

  const USE_COLORS = {
    "Mitigation":   "#4a7c59",
    "Adaptation":   "#4a6f8a",
    "Dual benefit": "#7a6b8a",
  };

  const REGIONS = [
    { key: "all",                            label: "All regions" },
    { key: "East Asia & Pacific",            label: "E. Asia & Pacific" },
    { key: "Western Europe",                 label: "W. Europe" },
    { key: "US & Canada",                    label: "US & Canada" },
    { key: "Latin America & Caribbean",      label: "Latin America" },
    { key: "Central Asia & Eastern Europe",  label: "C. Asia & E. Europe" },
    { key: "South Asia",                     label: "South Asia" },
    { key: "Sub-Saharan Africa",             label: "Sub-Saharan Africa" },
    { key: "Middle East & North Africa",     label: "Middle East & N. Africa" },
    { key: "Other Oceania",                  label: "Other Oceania" },
    { key: "Transregional",                  label: "Transregional" },
  ];

  function nodeColor(id) {
    if (id.startsWith("Origin:")) return STATUS_COLORS[id.slice(7)]  || "#ccc";
    if (id.startsWith("Use:"))    return USE_COLORS[id.slice(4)]     || "#ccc";
    if (id.startsWith("Dest:"))   return STATUS_COLORS[id.slice(5)]  || "#ccc";
    return "#ccc";
  }

  // Links are colored by the Use node in the chain
  function linkColor(d) {
    if (d.target.id.startsWith("Use:")) return nodeColor(d.target.id);  // Origin→Use
    if (d.source.id.startsWith("Use:")) return nodeColor(d.source.id);  // Use→Dest
    return nodeColor(d.source.id);
  }

  function displayLabel(id) {
    return id.replace(/^\w+:/, "");
  }

  // ── Step-highlight state ──────────────────────────────────
  let currentStep = 1;
  let pendingStep = null;
  let linkPaths   = null;
  let nodeRects   = null;
  let nodeLabels  = null;

  // ── Region filter state ───────────────────────────────────
  let selectedRegions = new Set();   // empty = all regions
  let rawData = null;

  function dimmedForStep(stepNum) {
    if (stepNum === 1) return new Set(["Use:Adaptation", "Use:Dual benefit"]);
    if (stepNum === 2) return new Set(["Use:Mitigation", "Use:Dual benefit"]);
    return new Set();
  }

  function applyStep(stepNum, animate) {
    const dim = dimmedForStep(stepNum);
    const dur = animate ? 400 : 0;

    linkPaths.transition().duration(dur)
      .attr("stroke-opacity", function (d) {
        return (dim.has(d.source.id) || dim.has(d.target.id)) ? 0.04 : 0.3;
      });

    nodeRects.transition().duration(dur)
      .attr("fill-opacity", function (d) {
        return dim.has(d.id) ? 0.12 : 1;
      });

    nodeLabels.transition().duration(dur)
      .attr("fill-opacity", function (d) {
        return dim.has(d.id) ? 0.15 : 1;
      });
  }

  // ── Public API ────────────────────────────────────────────
  window.SankeyChart = {
    setStep: function (stepNum) {
      currentStep = stepNum;
      if (linkPaths) {
        applyStep(stepNum, true);
      } else {
        pendingStep = stepNum;
      }
    },
  };

  // ── Data aggregation ─────────────────────────────────────
  function aggregate(data, selRegions) {
    const rows = (!selRegions || selRegions.size === 0)
      ? data
      : data.filter(function (d) { return selRegions.has(d.Region_Destination); });

    const ou = new Map();  // Origin → Use
    const ud = new Map();  // Use    → Dest

    rows.forEach(function (d) {
      const v = +d.Value;
      if (!v || isNaN(v)) return;
      const O = "Origin:" + d.Development_Status_Origin;
      const U = "Use:"    + d.Use;
      const D = "Dest:"   + d.Development_Status_Destination;

      const k1 = O + "|" + U; ou.set(k1, (ou.get(k1) || 0) + v);
      const k2 = U + "|" + D; ud.set(k2, (ud.get(k2) || 0) + v);
    });

    const links = [];
    [ou, ud].forEach(function (m) {
      m.forEach(function (v, k) {
        const [s, t] = k.split("|");
        links.push({ source: s, target: t, value: v });
      });
    });

    const nodeSet = new Set();
    links.forEach(function (l) { nodeSet.add(l.source); nodeSet.add(l.target); });
    const nodes = Array.from(nodeSet).map(function (id) { return { id: id }; });

    return { nodes: nodes, links: links };
  }

  // ── Dropdown positioning (responsive, called after render) ──
  function setFilterTop() {
    const filtersDiv = document.getElementById("sankey-region-filters");
    if (!filtersDiv) return;
    const H       = container.clientHeight;
    const tall    = H > 480;
    const TOP_PAD = tall ? 10 : 8;
    const TITLE_H = tall ? 22 : 26;
    filtersDiv.style.top = (TOP_PAD + TITLE_H + 4) + "px";
  }

  // ── Dropdown trigger label ────────────────────────────────
  function updateTriggerLabel(trigger) {
    const arrow = " ▾";
    if (selectedRegions.size === 0) {
      trigger.textContent = "All regions" + arrow;
    } else if (selectedRegions.size === 1) {
      const key    = Array.from(selectedRegions)[0];
      const region = REGIONS.find(function (r) { return r.key === key; });
      trigger.textContent = (region ? region.label : key) + arrow;
    } else {
      trigger.textContent = selectedRegions.size + " regions" + arrow;
    }
  }

  // ── Checkbox row helper ───────────────────────────────────
  function makeCheckItem(value, label, checked, onChange) {
    const item = document.createElement("label");
    item.style.display        = "flex";
    item.style.alignItems     = "center";
    item.style.gap            = "6px";
    item.style.padding        = "3px 12px";
    item.style.cursor         = "pointer";
    item.style.fontFamily     = FONT;
    item.style.fontSize       = "0.65rem";
    item.style.letterSpacing  = "0.07em";
    item.style.textTransform  = "uppercase";
    item.style.color          = "var(--color-ink-lighter, #888)";
    item.style.whiteSpace     = "nowrap";

    item.addEventListener("mouseenter", function () { item.style.background = "var(--color-border, #eee)"; });
    item.addEventListener("mouseleave", function () { item.style.background = ""; });

    const cb    = document.createElement("input");
    cb.type     = "checkbox";
    cb.value    = value;
    cb.checked  = checked;
    cb.addEventListener("change", function () { onChange(cb.checked); });

    item.appendChild(cb);
    item.appendChild(document.createTextNode(" " + label));
    return item;
  }

  // ── Build multiselect dropdown (once) ────────────────────
  function buildDropdown() {
    if (document.getElementById("sankey-region-filters")) return;

    // Outer wrapper reuses .ghg-map-filters for absolute positioning
    const wrapper = document.createElement("div");
    wrapper.className = "ghg-map-filters";
    wrapper.id = "sankey-region-filters";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";

    // Label
    const lbl = document.createElement("span");
    lbl.style.fontFamily    = FONT;
    lbl.style.fontSize      = "0.65rem";
    lbl.style.letterSpacing = "0.07em";
    lbl.style.textTransform = "uppercase";
    lbl.style.color         = "var(--color-ink-lighter, #888)";
    lbl.textContent = "Destination Region";
    wrapper.appendChild(lbl);

    // Dropdown shell
    const dropWrap = document.createElement("div");
    dropWrap.style.position = "relative";
    dropWrap.style.display  = "inline-block";

    // Trigger
    const trigger = document.createElement("button");
    trigger.className      = "ghg-map-filter-btn";
    trigger.style.minWidth = "130px";
    trigger.style.textAlign = "left";
    trigger.textContent    = "All regions ▾";

    // Panel
    const panel = document.createElement("div");
    panel.style.display      = "none";
    panel.style.position     = "absolute";
    panel.style.top          = "calc(100% + 3px)";
    panel.style.left         = "0";
    panel.style.zIndex       = "200";
    panel.style.background   = "var(--color-bg, #fff)";
    panel.style.border       = "1px solid var(--color-border, #ccc)";
    panel.style.borderRadius = "2px";
    panel.style.padding      = "4px 0";
    panel.style.minWidth     = "180px";
    panel.style.boxShadow    = "0 2px 8px rgba(0,0,0,0.12)";

    let panelOpen = false;

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? "block" : "none";
    });

    document.addEventListener("click", function () {
      if (panelOpen) { panelOpen = false; panel.style.display = "none"; }
    });

    panel.addEventListener("click", function (e) { e.stopPropagation(); });

    // "All regions" row
    const allItem = makeCheckItem("all", "All regions", true, function (checked) {
      if (!checked) return;
      selectedRegions.clear();
      panel.querySelectorAll("input[type=checkbox]").forEach(function (c) {
        c.checked = c.value === "all";
      });
      updateTriggerLabel(trigger);
      const agg = aggregate(rawData, selectedRegions);
      render(agg.nodes, agg.links);
    });
    panel.appendChild(allItem);

    const sep = document.createElement("hr");
    sep.style.margin     = "4px 0";
    sep.style.border     = "none";
    sep.style.borderTop  = "1px solid var(--color-border, #ddd)";
    panel.appendChild(sep);

    // Individual region rows
    REGIONS.slice(1).forEach(function (r) {
      const item = makeCheckItem(r.key, r.label, false, function (checked) {
        const allCb = panel.querySelector("input[value=\"all\"]");
        if (checked) {
          selectedRegions.add(r.key);
          if (allCb) allCb.checked = false;
        } else {
          selectedRegions.delete(r.key);
          if (selectedRegions.size === 0 && allCb) allCb.checked = true;
        }
        updateTriggerLabel(trigger);
        const agg = aggregate(rawData, selectedRegions);
        render(agg.nodes, agg.links);
      });
      panel.appendChild(item);
    });

    dropWrap.appendChild(trigger);
    dropWrap.appendChild(panel);
    wrapper.appendChild(dropWrap);
    container.appendChild(wrapper);
  }

  // ── Render ───────────────────────────────────────────────
  function render(rawNodes, rawLinks) {
    d3.select(container).selectAll("svg").remove();
    linkPaths  = null;
    nodeRects  = null;
    nodeLabels = null;

    const W = container.clientWidth;
    const H = container.clientHeight;

    const tall     = H > 480;
    const TOP_PAD  = tall ? 10 : 8;
    const TITLE_H  = tall ? 22 : 26;
    const FILTER_H = tall ? 44 : 56;

    // Responsive font sizes: scale with container width (~724px max on desktop).
    const baseLabelPx  = Math.max(9,  Math.min(15, W / 50));
    const useLabelPx   = Math.max(8,  Math.min(13, baseLabelPx * 0.87));
    const colHeaderPx  = Math.max(8,  Math.min(12, baseLabelPx * 0.82));

    const margin = {
      top:    TOP_PAD + TITLE_H + FILTER_H + 4,
      right:  118,
      bottom: 20,
      left:   78,
    };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top  - margin.bottom;

    const svg = d3.select(container).append("svg")
      .attr("width", W).attr("height", H);

    const g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const nodes = rawNodes.map(function (n) { return { id: n.id }; });
    const links = rawLinks.map(function (l) {
      return { source: l.source, target: l.target, value: l.value };
    });

    d3.sankey()
      .nodeId(function (d) { return d.id; })
      .nodeAlign(d3.sankeyLeft)
      .nodeWidth(13)
      .nodePadding(6)
      .extent([[0, 0], [innerW, innerH]])
      ({ nodes: nodes, links: links });

    // ── Tooltip ───────────────────────────────────────────
    const tooltip = d3.select(container).select(".ghg-line-tooltip").empty()
      ? d3.select(container).append("div").attr("class", "ghg-line-tooltip").style("display", "none")
      : d3.select(container).select(".ghg-line-tooltip");

    tooltip.style("display", "none");

    function showTooltip(event, html) {
      const [mx, my] = d3.pointer(event, container);
      const flip = mx > W * 0.55;
      tooltip.style("display", "block").html(html)
        .style("left",  flip ? "auto"               : (mx + 12) + "px")
        .style("right", flip ? (W - mx + 12) + "px" : "auto")
        .style("top",   (my - 12) + "px");
    }

    // ── Links — colored by Use category ───────────────────
    linkPaths = g.append("g").attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", function (d) { return linkColor(d); })
        .attr("stroke-width", function (d) { return Math.max(1, d.width); })
        .attr("stroke-opacity", 0.3)
        .on("mousemove", function (event, d) {
          showTooltip(event,
            "<strong>" + displayLabel(d.source.id) + " → " +
            displayLabel(d.target.id) + "</strong><br>" +
            d3.format(",.1f")(d.value) + " USD billion");
        })
        .on("mouseleave", function () { tooltip.style("display", "none"); });

    // ── Node rects ────────────────────────────────────────
    nodeRects = g.append("g")
      .selectAll("rect")
      .data(nodes)
      .join("rect")
        .attr("x",      function (d) { return d.x0; })
        .attr("y",      function (d) { return d.y0; })
        .attr("width",  function (d) { return d.x1 - d.x0; })
        .attr("height", function (d) { return Math.max(1, d.y1 - d.y0); })
        .attr("fill",   function (d) { return nodeColor(d.id); })
        .attr("stroke", "none")
        .on("mousemove", function (event, d) {
          showTooltip(event,
            "<strong>" + displayLabel(d.id) + "</strong><br>" +
            d3.format(",.1f")(d.value) + " USD billion");
        })
        .on("mouseleave", function () { tooltip.style("display", "none"); });

    // ── Node labels ───────────────────────────────────────
    // Origin: label LEFT; Use + Dest: label RIGHT
    const useX  = d3.min(nodes.filter(function (n) { return n.id.startsWith("Use:"); }),
                         function (n) { return n.x0; }) || 0;
    const col1T = useX + 1;

    const labelG = svg.append("g")
      .attr("font-family", FONT)
      .attr("fill", "#1a1a1a");

    nodeLabels = labelG.selectAll("text")
      .data(nodes)
      .join("text")
        .attr("x", function (d) {
          return d.x0 < col1T
            ? margin.left + d.x0 - 5
            : margin.left + d.x1 + 5;
        })
        .attr("y",           function (d) { return margin.top + (d.y0 + d.y1) / 2; })
        .attr("dy",          "0.35em")
        .attr("text-anchor", function (d) { return d.x0 < col1T ? "end" : "start"; })
        .attr("font-size",   function (d) {
          return (d.x0 < col1T || d.id.startsWith("Dest:")) ? baseLabelPx + "px" : useLabelPx + "px";
        })
        .text(function (d) { return displayLabel(d.id); });

    // ── Column headers ────────────────────────────────────
    const COLS = [
      { prefix: "Origin:", label: "Origin" },
      { prefix: "Use:",    label: "Use" },
      { prefix: "Dest:",   label: "Destination" },
    ];

    COLS.forEach(function (col) {
      const colNodes = nodes.filter(function (n) { return n.id.startsWith(col.prefix); });
      if (!colNodes.length) return;
      const cx = margin.left + colNodes[0].x0 + (colNodes[0].x1 - colNodes[0].x0) / 2;
      svg.append("text")
        .attr("x",              cx)
        .attr("y",              margin.top - 8)
        .attr("text-anchor",    "middle")
        .attr("font-family",    FONT)
        .attr("font-size",      colHeaderPx + "px")
        .attr("letter-spacing", "0.08em")
        .attr("fill",           "#888")
        .style("text-transform", "uppercase")
        .text(col.label.toUpperCase());
    });

    // ── Chart title ───────────────────────────────────────
    svg.append("text")
      .attr("class",       "ghg-line-title")
      .attr("x",           W / 2)
      .attr("y",           TOP_PAD + TITLE_H - 4)
      .attr("text-anchor", "middle")
      .text("Global Climate Finance Flows (USD Billions)");

    // ── Source note ───────────────────────────────────────
    svg.append("a")
      .attr("href", "https://www.climatepolicyinitiative.org/resources/data-visualizations/global-landscape-of-climate-finance-data-dashboard/")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("text")
      .attr("class",       "ghg-line-source")
      .attr("x",           W - 8)
      .attr("y",           H - 5)
      .attr("text-anchor", "end")
      .text("Source: Climate Policy Initiative");

    applyStep(currentStep, false);

    if (pendingStep !== null) {
      applyStep(pendingStep, false);
      currentStep = pendingStep;
      pendingStep = null;
    }

    setFilterTop();
  }

  // ── Load + build ─────────────────────────────────────────
  function attemptBuild() {
    if (container.clientWidth > 0 && container.clientHeight > 0) {
      buildDropdown();
      const agg = aggregate(rawData, selectedRegions);
      render(agg.nodes, agg.links);

      let resizeTimer;
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            const agg2 = aggregate(rawData, selectedRegions);
            render(agg2.nodes, agg2.links);
          }, 200);
        }).observe(container);
      }
    } else {
      requestAnimationFrame(attemptBuild);
    }
  }

  d3.csv(CSV_URL).then(function (data) {
    rawData = data;
    attemptBuild();
  }).catch(function (err) {
    console.error("Sankey: failed to load data", err);
  });

})();
