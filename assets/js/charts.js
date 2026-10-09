import { CONFIG, HOLDINGS } from "./config.js";
import { fetchHistory, candleSummary, normalizeHistory } from "./market.js";
const money = (value) =>
  "₹" + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const date = (timestamp) => new Date(timestamp * 1000).toLocaleString("en-IN");

export async function setupCharts(loadScript, { embedded, reduced }) {
  const page = document.body.dataset.page;
  if (page === "journey") return setupPortfolio(loadScript, reduced);
  const analysis = page === "analysis",
    status = document.querySelector("#dataStatus");
  const empty = document.querySelector("#chartEmpty"),
    overlay = document.querySelector("#chartLoading");
  let chart = null,
    volume = null,
    controller = null,
    sequence = 0,
    selectedResolution = "1D",
    lastCaption = "",
    chartLibrary = false,
    disposed = false;
  // Library errors leave the data form and exact-value table fully usable.
  const libraryReady = loadScript(
    analysis ? CONFIG.cdn.apex : CONFIG.cdn.chart,
    analysis ? "ApexCharts" : "Chart",
  )
    .then(() => {
      chartLibrary = true;
    })
    .catch(() => {
      chartLibrary = false;
    });
  const cleanup = () => {
    disposed = true;
    controller?.abort();
    chart?.destroy();
    volume?.destroy();
  };
  const notify = (rows, meta) => {
    const detail = { rows: rows.slice(-48), meta };
    window.dispatchEvent(new CustomEvent("pever:data", { detail }));
    if (embedded)
      parent.postMessage({ type: "pever:data", ...detail }, location.origin);
  };
  const showTable = (rows) => {
    const tbody = document.querySelector("#priceTable tbody"),
      fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const value of [date(row.t), row.o, row.h, row.l, row.c, row.v]) {
        const td = document.createElement("td");
        td.textContent =
          typeof value === "number"
            ? value.toLocaleString("en-IN", { maximumFractionDigits: 4 })
            : value;
        tr.append(td);
      }
      fragment.append(tr);
    }
    tbody.replaceChildren(fragment);
  };
  const setStats = (rows) => {
    const summary = candleSummary(rows);
    document.querySelector("#dispPrice").textContent = money(summary.c);
    const change = document.querySelector("#dispChange");
    change.textContent =
      summary.change === null
        ? "—"
        : `${summary.change >= 0 ? "+" : ""}${summary.change.toFixed(2)}%`;
    change.className =
      summary.change === null ? "" : summary.change >= 0 ? "up" : "down";
    document.querySelector("#dispHigh").textContent = money(summary.h);
    document.querySelector("#dispLow").textContent = money(summary.l);
    document.querySelector("#dispVolume").textContent =
      summary.v.toLocaleString("en-IN");
  };
  async function render(rows, isCurrent = () => true) {
    await libraryReady;
    if (disposed || !isCurrent()) return;
    if (!chartLibrary) {
      document.querySelector(".data-table-wrap").open = true;
      empty.textContent =
        "Chart library unavailable. Exact data is shown below.";
      return false;
    }
    if (analysis) {
      const common = {
        theme: { mode: "dark" },
        grid: { borderColor: "#bce8dd12" },
        dataLabels: { enabled: false },
        tooltip: { theme: "dark" },
        xaxis: {
          type: "datetime",
          labels: {
            datetimeUTC: false,
            style: { fontSize: "9px", fontFamily: "JetBrains Mono" },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        chart: {
          background: "transparent",
          foreColor: "#acb9b6",
          fontFamily: "Manrope, sans-serif",
          animations: { enabled: !reduced() },
          zoom: { enabled: true },
          toolbar: { show: true, tools: { download: false } },
        },
      };
      const priceSeries = [
        {
          name: "Price",
          data: rows.map((r) => ({ x: r.t * 1000, y: [r.o, r.h, r.l, r.c] })),
        },
      ];
      const volumeSeries = [
        { name: "Volume", data: rows.map((r) => ({ x: r.t * 1000, y: r.v })) },
      ];
      if (chart && volume) {
        await Promise.all([
          chart.updateSeries(priceSeries, false),
          volume.updateSeries(volumeSeries, false),
        ]);
      } else {
        chart = new window.ApexCharts(
          document.querySelector("#candlestickChart"),
          {
            ...common,
            series: priceSeries,
            chart: {
              ...common.chart,
              type: "candlestick",
              height: 340,
              id: "price-chart",
            },
            plotOptions: {
              candlestick: {
                colors: { upward: "#bce8dd", downward: "#e89eaa" },
                wick: { useFillColor: true },
              },
            },
            yaxis: {
              labels: {
                formatter: (v) => money(v),
                style: { fontSize: "9px" },
              },
              tooltip: { enabled: true },
            },
            responsive: [
              { breakpoint: 700, options: { chart: { height: 305 } } },
            ],
          },
        );
        volume = new window.ApexCharts(document.querySelector("#volumeChart"), {
          ...common,
          series: volumeSeries,
          chart: {
            ...common.chart,
            type: "bar",
            height: 130,
            id: "volume-chart",
            toolbar: { show: false },
          },
          colors: ["#7bb7b6"],
          plotOptions: { bar: { columnWidth: "70%" } },
          xaxis: { ...common.xaxis, labels: { show: false } },
          yaxis: {
            labels: {
              formatter: (v) => (v / 1000000).toFixed(1) + "M",
              style: { fontSize: "9px" },
            },
          },
          responsive: [
            { breakpoint: 700, options: { chart: { height: 120 } } },
          ],
        });
        await Promise.all([chart.render(), volume.render()]);
      }
    } else {
      const palette = ["#e5b18e", "#9bbcf0", "#d7d399", "#bce8dd", "#b9a4e3"];
      // Reuse the instance on every successful query (fixes the original canvas leak).
      const data = {
        labels: rows.map((r) => date(r.t)),
        datasets: ["Open", "High", "Low", "Close", "Volume"].map((name, i) => ({
          label: name,
          data: rows.map((r) => r[["o", "h", "l", "c", "v"][i]]),
          borderColor: palette[i],
          borderWidth: i === 3 ? 2 : 1.2,
          backgroundColor: palette[i],
          pointRadius: 0,
          pointHitRadius: 7,
          fill: false,
          tension: 0,
          yAxisID: i === 4 ? "volume" : "price",
        })),
      };
      if (chart) {
        chart.data = data;
        chart.update("none");
      } else
        chart = new window.Chart(document.querySelector("#stockChart"), {
          type: "line",
          data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: reduced() ? false : { duration: 700 },
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                position: "top",
                labels: {
                  color: "#cbd3cc",
                  usePointStyle: true,
                  boxWidth: 5,
                  padding: 15,
                  font: { size: 10 },
                },
              },
              tooltip: {
                backgroundColor: "#102028",
                titleColor: "#d9b783",
                bodyColor: "#eee9dd",
              },
            },
            scales: {
              x: {
                ticks: {
                  color: "#8eaaa7",
                  maxTicksLimit: 6,
                  maxRotation: 0,
                  font: { size: 8 },
                },
                grid: { color: "#bce8dd08" },
                title: { display: true, text: "Date", color: "#8eaaa7" },
              },
              price: {
                type: "linear",
                position: "left",
                ticks: { color: "#8eaaa7", font: { size: 9 } },
                grid: { color: "#bce8dd12" },
                title: { display: true, text: "Price (INR)", color: "#8eaaa7" },
              },
              volume: {
                type: "linear",
                position: "right",
                ticks: {
                  color: "#b9a4e3",
                  font: { size: 9 },
                  callback: (value) =>
                    Intl.NumberFormat("en", { notation: "compact" }).format(
                      value,
                    ),
                },
                grid: { drawOnChartArea: false },
                title: { display: true, text: "Volume", color: "#b9a4e3" },
              },
            },
          },
        });
    }
    empty.hidden = true;
    return true;
  }
  async function request(query) {
    controller?.abort();
    controller = new AbortController();
    const ownController = controller,
      id = ++sequence;
    overlay.hidden = false;
    status.className = "data-status";
    status.textContent = `Requesting ${query.symbol} · ${query.resolution}…`;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      ownController.abort();
    }, 18000);
    try {
      const rows = await fetchHistory(query, ownController.signal);
      await libraryReady; // Prevent an older request from rendering after a slower CDN load.
      if (id !== sequence || disposed) return;
      showTable(rows);
      const hasChart = await render(rows, () => id === sequence);
      if (id !== sequence || disposed) return;
      if (analysis) {
        setStats(rows);
        document.querySelector("#dispSymbol").textContent = query.symbol;
      }
      lastCaption = `${query.symbol} · ${query.resolution} · ${rows.length.toLocaleString()} bars · ${date(rows[0].t)} → ${date(rows.at(-1).t)}`;
      document.querySelector("#dataCaption").textContent = lastCaption;
      status.textContent = hasChart
        ? "Price history received. Explore the chart or exact values below."
        : "Price history received. The chart library is unavailable; use the exact values below.";
      notify(rows, {
        symbol: query.symbol,
        resolution: query.resolution,
        source: "Moneycontrol",
      });
    } catch (error) {
      if (
        id !== sequence ||
        disposed ||
        (error.name === "AbortError" && !timedOut)
      )
        return;
      status.className = "data-status error";
      const reason = timedOut
        ? "The data provider took too long to respond."
        : error instanceof TypeError
          ? "Cannot reach Moneycontrol. The connection or the provider’s browser access policy may be blocking this request."
          : error.message;
      status.textContent = `${reason} ${lastCaption ? "The last successful result remains visible: " + lastCaption : "No price data has been loaded."}`;
    } finally {
      clearTimeout(timeout);
      if (id === sequence) overlay.hidden = true;
    }
  }
  document
    .querySelector("#historyImport")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      controller?.abort();
      const id = ++sequence;
      overlay.hidden = false;
      status.className = "data-status";
      status.textContent = "Reading your exported price history…";
      try {
        if (file.size > 8 * 1024 * 1024)
          throw new Error("Please choose a JSON export smaller than 8 MB.");
        const imported = JSON.parse(await file.text());
        const rows = normalizeHistory(imported);
        await libraryReady;
        if (id !== sequence || disposed) return;
        showTable(rows);
        await render(rows, () => id === sequence);
        if (id !== sequence || disposed) return;
        const symbol =
          String(
            imported.symbol ||
              (analysis
                ? document.querySelector("#symbolInput").value
                : document.querySelector("#symbol").value),
          )
            .trim()
            .toUpperCase()
            .slice(0, 40) || "IMPORTED";
        const resolution = String(
          imported.resolution ||
            (analysis
              ? selectedResolution
              : document.querySelector("#resolution").value),
        ).slice(0, 5);
        if (analysis) {
          setStats(rows);
          document.querySelector("#dispSymbol").textContent = symbol;
        }
        lastCaption = `${symbol} · ${resolution} · ${rows.length.toLocaleString()} bars · Imported JSON · ${date(rows[0].t)} → ${date(rows.at(-1).t)}`;
        document.querySelector("#dataCaption").textContent = lastCaption;
        status.textContent =
          "Export loaded from your device. These are imported values, not a live feed.";
        notify(rows, { symbol, resolution, source: "Imported JSON" });
      } catch (error) {
        if (id !== sequence || disposed) return;
        status.className = "data-status error";
        status.textContent = `Could not import this file: ${error.message}. ${lastCaption ? "The last successful result remains visible: " + lastCaption : "No price data has been loaded."}`;
      } finally {
        if (id === sequence) overlay.hidden = true;
        event.target.value = "";
      }
    });
  if (analysis) {
    const run = () => {
      const symbol = document
          .querySelector("#symbolInput")
          .value.trim()
          .toUpperCase(),
        to = Math.floor(Date.now() / 1000);
      return request({
        symbol,
        resolution: selectedResolution,
        from: to - 365 * 86400,
        to,
        countback: selectedResolution === "1D" ? 300 : 2000,
      });
    };
    document
      .querySelector("#analysisForm")
      .addEventListener("submit", (event) => {
        event.preventDefault();
        run();
      });
    document.querySelectorAll("[data-res]").forEach((button) =>
      button.addEventListener("click", () => {
        selectedResolution = button.dataset.res;
        document.querySelectorAll("[data-res]").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        run();
      }),
    );
    run();
  } else {
    const today = new Date(),
      start = new Date(today);
    start.setDate(start.getDate() - 30);
    const localDay = (day) =>
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    document.querySelector("#startDate").value = localDay(start);
    document.querySelector("#endDate").value = localDay(today);
    document.querySelector("#timezoneNote").textContent =
      `Dates and times use your device timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;
    document.querySelector("#stockForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = (id) => document.getElementById(id).value;
      request({
        symbol: value("symbol").trim().toUpperCase(),
        resolution: value("resolution"),
        from:
          new Date(`${value("startDate")}T${value("startTime")}`).getTime() /
          1000,
        to:
          new Date(`${value("endDate")}T${value("endTime")}`).getTime() / 1000,
      });
    });
  }
  return {
    dispose: cleanup,
    setMotion: (enabled) => {
      if (!analysis && chart) {
        chart.options.animation = enabled ? { duration: 700 } : false;
      } else if (analysis) {
        chart?.updateOptions(
          { chart: { animations: { enabled } } },
          false,
          false,
        );
        volume?.updateOptions(
          { chart: { animations: { enabled } } },
          false,
          false,
        );
      }
    },
  };
}

async function setupPortfolio(loadScript, reduced) {
  const legend = document.querySelector("#chartLegend"),
    total = HOLDINGS.reduce((sum, h) => sum + h.value, 0);
  let chart = null;
  // Build the accessible legend even when Chart.js cannot be downloaded.
  HOLDINGS.forEach((holding, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "legend-item";
    button.setAttribute("aria-pressed", "true");
    button.innerHTML = `<span class="legend-color" style="background:${holding.color}"></span><span class="legend-info"><span class="legend-name">${holding.short}</span><span class="legend-value"> · ${money(holding.value)}</span></span><span class="legend-percent">${((holding.value / total) * 100).toFixed(1)}%</span>`;
    button.addEventListener("mouseenter", () => {
      chart?.setActiveElements([{ datasetIndex: 0, index }]);
      chart?.update("none");
    });
    button.addEventListener("mouseleave", () => {
      chart?.setActiveElements([]);
      chart?.update("none");
    });
    button.addEventListener("click", () => {
      if (chart) {
        chart.toggleDataVisibility(index);
        button.setAttribute(
          "aria-pressed",
          String(chart.getDataVisibility(index)),
        );
        chart.update();
      }
    });
    legend.append(button);
  });
  try {
    await loadScript(CONFIG.cdn.chart, "Chart");
    chart = new window.Chart(document.querySelector("#portfolioChart"), {
      type: "doughnut",
      data: {
        labels: HOLDINGS.map((h) => h.short),
        datasets: [
          {
            data: HOLDINGS.map((h) => h.value),
            backgroundColor: HOLDINGS.map((h) => h.color),
            borderWidth: 2,
            borderColor: "#12262b",
            hoverOffset: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "78%",
        radius: "90%",
        animation: reduced() ? false : { duration: 1000 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#102028",
            titleColor: "#d9b783",
            bodyColor: "#eee9dd",
            callbacks: {
              label: (ctx) =>
                `${money(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)`,
            },
          },
        },
      },
    });
  } catch {
    document
      .querySelector("#portfolioChart")
      .setAttribute(
        "aria-label",
        "Chart unavailable. All holdings and values are listed beside this chart.",
      );
  }
  return {
    dispose: () => chart?.destroy(),
    setMotion: (enabled) => {
      if (chart) chart.options.animation = enabled ? { duration: 700 } : false;
    },
  };
}
