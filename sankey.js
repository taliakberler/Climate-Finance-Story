// ============================================================
//  Section 3 Sankey — Global Climate Finance Flows
//  Layers: Development_Status_Origin → Use →
//          Region_Destination → Development_Status_Destination
//  Data: assets/data/CPI_finance.csv (values in USD billions)
// ============================================================
(function () {
  "use strict";

  const CSV_URL = "assets/data/CPI_finance.csv";
  const container = document.getElementById("sankey-chart");
  if (!container) return;

  // ── Color palette — mirrors income-group reds in the rest of the story ──
  const STATUS_COLORS = {
    "Advanced":      "#c11c2a",   // NYT red  (≈ High income)
    "China":         "#e8695a",   // warm red (≈ Upper-middle)
    "EMDE":          "#f4a97f",   // salmon   (≈ Lower-middle)
    "LDC":           "#fdd9b0",   // pale     (≈ Low income)
    "Transregional": "#bbb0a8",
    "Unknown":       "#d0cdc8",
  };

  // Use nodes — muted warm tones so they read as a separate category
  const USE_COLORS = {
    "Mitigation":    "#7a6a5a",
    "Adaptation":    "#a08060",
    "Dual benefit":  "#c8aa80",
  };

  // Region nodes — earthy mid-tones drawn from the same warm palette
  const REGION_COLORS = {
    "East Asia & Pacific":           "#5a7a8a",
    "Western Europe":                "#6a8a7a",
    "US & Canada":                   "#7a8a6a",
    "Latin America & Caribbean":     "#8a8a5a",
    "Central Asia & Eastern Europe": "#8a7a5a",
    "South Asia":                    "#9a8060",
    "Sub-Saharan Africa":            "#b07050",
    "Middle East & North Africa":    "#a87860",
    "Other Oceania":                 "#6a8090",
    "Transregional":                 "#bbb0a8",
    "Unknown":                       "#d0cdc8",
  };

  // Short labels for tight region column
  const REGION_SHORT = {
    "East Asia & Pacific":           "E. Asia & Pacific",
    "Western Europe":                "W. Europe",
    "US & Canada":                   "US & Canada",
    "Latin America & Caribbean":     "Latin America & Caribbean",
    "Central Asia & Eastern Europe": "C. Asia & E. Europe",
    "South Asia":                    "South Asia",
    "Sub-Saharan Africa":            "Sub-Saharan Africa",
    "Middle East & North Africa":    "Middle East & N. Africa",
    "Other Oceania":                 "Other Oceania",
    "Transregional":                 "Transregional",
    "Unknown":                       "Unknown",
  };

  function nodeColor(id) {
    if (id.startsWith("Origin:")) return STATUS_COLORS[id.slice(7)]  || "#ccc";
    if (id.startsWith("Use:"))    return USE_COLORS[id.slice(4)]     || "#ccc";
    if (id.startsWith("Region:")) return REGION_COLORS[id.slice(7)]  || "#ccc";
    if (id.startsWith("Dest:"))   return STATUS_COLORS[id.slice(5)]  || "#ccc";
    return "#ccc";
  }

  function displayLabel(id) {
    if (id.startsWith("Region:")) return REGION_SHORT[id.slice(7)] || id.slice(7);
    return id.replace(/^\w+:/, "");
  }

  // ── Step-highlight state ──────────────────────────────────
  let currentStep  = 1;
  let pendingStep  = null;
  let linkPaths    = null;
  let nodeRects    = null;
  let nodeLabels   = null;

  // Returns the set of Use node IDs that should be dimmed for a given step
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
  function aggregate(data) {
    const ou  = new Map();  // Origin → Use
    const ur  = new Map();  // Use    → Region
    const rd  = new Map();  // Region → Dest

    data.forEach(function (d) {
      const v = +d.Value;
      if (!v || isNaN(v)) return;
      const O = "Origin:" + d.Development_Status_Origin;
      const U = "Use:"    + d.Use;
      const R = "Region:" + d.Region_Destination;
      const D = "Dest:"   + d.Development_Status_Destination;

      const k1 = O + "|" + U;  ou.set(k1, (ou.get(k1) || 0) + v);
      const k2 = U + "|" + R;  ur.set(k2, (ur.get(k2) || 0) + v);
      const k3 = R + "|" + D;  rd.set(k3, (rd.get(k3) || 0) + v);
    });

    const links = [];
    [ou, ur, rd].forEach(function (m) {
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

  // ── Render ───────────────────────────────────────────────
  function render(rawNodes, rawLinks) {
    d3.select(container).selectAll("*").remove();
    linkPaths = null;
    nodeRects = null;
    nodeLabels = null;

    const W = container.clientWidth;
    const H = container.clientHeight;

    // Tighter margins for a wider Sankey flow area on desktop
    const margin = { top: 58, right: 118, bottom: 20, left: 78 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top  - margin.bottom;

    const svg = d3.select(container).append("svg")
      .attr("width", W).attr("height", H);

    const g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Deep-copy nodes + links (d3-sankey mutates them)
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
    const tooltip = d3.select(container).append("div")
      .attr("class", "ghg-line-tooltip")
      .style("display", "none");

    function showTooltip(event, html) {
      const [mx, my] = d3.pointer(event, container);
      const flip = mx > W * 0.55;
      tooltip.style("display", "block").html(html)
        .style("left",  flip ? "auto"              : (mx + 12) + "px")
        .style("right", flip ? (W - mx + 12) + "px" : "auto")
        .style("top",   (my - 12) + "px");
    }

    // ── Links ─────────────────────────────────────────────
    linkPaths = g.append("g").attr("fill", "none")
      .selectAll("path")
      .data(links)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", function (d) { return nodeColor(d.source.id); })
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
        .attr("x", function (d) { return d.x0; })
        .attr("y", function (d) { return d.y0; })
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
    // Col 0 (Origin): label LEFT of node
    // Col 1 (Use), 2 (Region), 3 (Dest): label RIGHT of node
    const useX  = d3.min(nodes.filter(function (n) { return n.id.startsWith("Use:"); }),
                         function (n) { return n.x0; }) || 0;
    const col1T = useX + 1;  // anything with x0 < col1T is col 0

    const labelG = svg.append("g")
      .attr("font-family", "Franklin Gothic Medium, Arial Narrow, Arial, sans-serif")
      .attr("fill", "#1a1a1a");

    nodeLabels = labelG.selectAll("text")
      .data(nodes)
      .join("text")
        .attr("x", function (d) {
          return d.x0 < col1T
            ? margin.left + d.x0 - 5
            : margin.left + d.x1 + 5;
        })
        .attr("y", function (d) { return margin.top + (d.y0 + d.y1) / 2; })
        .attr("dy", "0.35em")
        .attr("text-anchor", function (d) { return d.x0 < col1T ? "end" : "start"; })
        .attr("font-size", function (d) {
          return (d.x0 < col1T || d.id.startsWith("Dest:")) ? "11px" : "9.5px";
        })
        .text(function (d) { return displayLabel(d.id); });

    // ── Column headers ────────────────────────────────────
    const COLS = [
      { prefix: "Origin:", label: "Origin" },
      { prefix: "Use:",    label: "Use" },
      { prefix: "Region:", label: "Destination Region" },
      { prefix: "Dest:",   label: "Destination" },
    ];

    COLS.forEach(function (col) {
      const colNodes = nodes.filter(function (n) { return n.id.startsWith(col.prefix); });
      if (!colNodes.length) return;
      const cx = margin.left + colNodes[0].x0 + (colNodes[0].x1 - colNodes[0].x0) / 2;
      svg.append("text")
        .attr("x", cx)
        .attr("y", margin.top - 8)
        .attr("text-anchor", "middle")
        .attr("font-family", "Franklin Gothic Medium, Arial Narrow, Arial, sans-serif")
        .attr("font-size", "9px")
        .attr("letter-spacing", "0.08em")
        .attr("fill", "#888")
        .style("text-transform", "uppercase")
        .text(col.label.toUpperCase());
    });

    // ── Chart title ───────────────────────────────────────
    svg.append("text")
      .attr("class", "ghg-line-title")
      .attr("x", W / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .text("Global Climate Finance Flows (USD Billions)");

    // ── Source note ───────────────────────────────────────
    svg.append("a")
      .attr("href", "https://www.climatepolicyinitiative.org/resources/data-visualizations/global-landscape-of-climate-finance-data-dashboard/")
      .attr("target", "_blank").attr("rel", "noopener noreferrer")
      .append("text")
      .attr("class", "ghg-line-source")
      .attr("x", W - 8)
      .attr("y", H - 5)
      .attr("text-anchor", "end")
      .text("Source: Climate Policy Initiative");

    // Apply the current step immediately (no animation on first render)
    applyStep(currentStep, false);

    if (pendingStep !== null) {
      applyStep(pendingStep, false);
      currentStep  = pendingStep;
      pendingStep  = null;
    }
  }

  // ── Load + build ─────────────────────────────────────────
  let cached = null;

  function attemptBuild() {
    if (container.clientWidth > 0 && container.clientHeight > 0) {
      render(cached.nodes, cached.links);

      let resizeTimer;
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            render(cached.nodes, cached.links);
          }, 200);
        }).observe(container);
      }
    } else {
      requestAnimationFrame(attemptBuild);
    }
  }

  d3.csv(CSV_URL).then(function (data) {
    cached = aggregate(data);
    attemptBuild();
  }).catch(function (err) {
    console.error("Sankey: failed to load data", err);
  });

})();
