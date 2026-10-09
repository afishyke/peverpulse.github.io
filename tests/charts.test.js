import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { setupCharts } from "../assets/js/charts.js";
const payload = {
  s: "ok",
  t: [1700000000, 1700086400],
  o: [100, 110],
  h: [115, 125],
  l: [95, 105],
  c: [110, 120],
  v: [2000, 3000],
};
const waitFor = async (fn) => {
  for (let i = 0; i < 100; i++) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Condition timed out");
};
function domFor(name) {
  const dom = new JSDOM(
    readFileSync(new URL("../" + name, import.meta.url), "utf8"),
    { url: "https://example.test/" + name, pretendToBeVisual: true },
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.location = dom.window.location;
  return dom;
}
class FakeChart {
  static instances = [];
  constructor(element, options) {
    this.element = element;
    this.options = options.options || options;
    this.data = options.data;
    this.series = options.series;
    this.destroyed = false;
    FakeChart.instances.push(this);
  }
  render() {
    return Promise.resolve();
  }
  updateSeries(series) {
    this.series = series;
    return Promise.resolve();
  }
  updateOptions() {}
  update() {
    this.updated = true;
  }
  destroy() {
    this.destroyed = true;
  }
  setActiveElements() {}
}
const script = async () => {};
const respond = async () => ({
  ok: true,
  json: async () => structuredClone(payload),
});
const submit = (id) =>
  document
    .getElementById(id)
    .dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
test("historical queries plot all five original series, update the same canvas, and reveal exact data", async () => {
  const dom = domFor("PEVERPICHART.html");
  FakeChart.instances = [];
  window.Chart = FakeChart;
  globalThis.fetch = respond;
  const controller = await setupCharts(script, {
    embedded: false,
    reduced: () => true,
  });
  submit("stockForm");
  await waitFor(() => document.querySelector("#chartEmpty").hidden);
  assert.equal(FakeChart.instances.length, 1);
  assert.deepEqual(
    FakeChart.instances[0].data.datasets.map((d) => d.label),
    ["Open", "High", "Low", "Close", "Volume"],
  );
  assert.deepEqual(FakeChart.instances[0].data.datasets[3].data, [110, 120]);
  assert.equal(document.querySelectorAll("tbody tr").length, 2);
  submit("stockForm");
  await waitFor(() => FakeChart.instances[0].updated);
  assert.equal(FakeChart.instances.length, 1);
  await waitFor(() => document.querySelector("#chartLoading").hidden);
  controller.dispose();
  assert.ok(FakeChart.instances[0].destroyed);
  dom.window.close();
});
test("API failure identifies the last successful result instead of relabeling stale prices", async () => {
  const dom = domFor("PEVERPICHART.html");
  FakeChart.instances = [];
  window.Chart = FakeChart;
  globalThis.fetch = respond;
  const controller = await setupCharts(script, {
    embedded: false,
    reduced: () => false,
  });
  submit("stockForm");
  await waitFor(() => document.querySelector("#chartLoading").hidden);
  document.querySelector("#symbol").value = "INFY";
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  submit("stockForm");
  await waitFor(() =>
    document.querySelector("#dataStatus").classList.contains("error"),
  );
  assert.match(document.querySelector("#dataCaption").textContent, /TATASTEEL/);
  assert.match(
    document.querySelector("#dataStatus").textContent,
    /last successful result remains visible: TATASTEEL/,
  );
  controller.dispose();
  dom.window.close();
});
test("candlesticks and volume load together, resolution changes retain real data, one candle gives no fabricated change", async () => {
  const dom = domFor("analysis.html");
  FakeChart.instances = [];
  window.ApexCharts = FakeChart;
  globalThis.fetch = respond;
  const controller = await setupCharts(script, {
    embedded: false,
    reduced: () => true,
  });
  await waitFor(() => document.querySelector("#chartEmpty").hidden);
  assert.equal(FakeChart.instances.length, 2);
  assert.equal(document.querySelector("#dispPrice").textContent, "₹120");
  assert.deepEqual(
    FakeChart.instances[0].series[0].data[0].y,
    [100, 115, 95, 110],
  );
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      s: "ok",
      t: [1700000000],
      o: [100],
      h: [115],
      l: [95],
      c: [110],
      v: [2000],
    }),
  });
  document.querySelector('[data-res="5m"]').click();
  await waitFor(
    () => document.querySelector("#dispChange").textContent === "—",
  );
  assert.equal(
    document.querySelector('[data-res="5m"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(FakeChart.instances.length, 2);
  assert.equal(document.querySelectorAll("tbody tr").length, 1);
  controller.dispose();
  dom.window.close();
});
test("a blocked chart CDN preserves the input form and full exact-value table", async () => {
  const dom = domFor("PEVERPICHART.html");
  globalThis.fetch = respond;
  const controller = await setupCharts(
    async () => {
      throw new Error("CDN blocked");
    },
    { embedded: false, reduced: () => true },
  );
  submit("stockForm");
  await waitFor(() => document.querySelector(".data-table-wrap").open);
  assert.equal(document.querySelectorAll("tbody tr").length, 2);
  assert.match(
    document.querySelector("#dataStatus").textContent,
    /library is unavailable/,
  );
  controller.dispose();
  dom.window.close();
});
test("a slower old response cannot replace a newer symbol result", async () => {
  const dom = domFor("analysis.html");
  FakeChart.instances = [];
  window.ApexCharts = FakeChart;
  let release;
  globalThis.fetch = () =>
    new Promise(
      (resolve) =>
        (release = () => resolve({ ok: true, json: async () => payload })),
    );
  const controller = await setupCharts(script, {
    embedded: false,
    reduced: () => true,
  });
  document.querySelector("#symbolInput").value = "INFY";
  globalThis.fetch = respond;
  submit("analysisForm");
  await waitFor(
    () => document.querySelector("#dispSymbol").textContent === "INFY",
  );
  release();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(document.querySelector("#dispSymbol").textContent, "INFY");
  assert.match(document.querySelector("#dataCaption").textContent, /INFY/);
  controller.dispose();
  dom.window.close();
});
test("JSON import preserves real values, announces its source, and updates the 3D data event", async () => {
  const dom = domFor("PEVERPICHART.html");
  FakeChart.instances = [];
  window.Chart = FakeChart;
  globalThis.fetch = respond;
  let data;
  window.addEventListener("pever:data", (event) => (data = event.detail));
  const controller = await setupCharts(script, {
    embedded: false,
    reduced: () => true,
  });
  const input = document.querySelector("#historyImport");
  Object.defineProperty(input, "files", {
    value: [
      {
        size: 150,
        text: async () =>
          JSON.stringify({ ...payload, symbol: "LOCAL", resolution: "1D" }),
      },
    ],
  });
  input.dispatchEvent(new window.Event("change"));
  await waitFor(() =>
    document
      .querySelector("#dataCaption")
      .textContent.includes("Imported JSON"),
  );
  assert.equal(data.meta.source, "Imported JSON");
  assert.equal(data.meta.symbol, "LOCAL");
  assert.equal(data.rows[1].c, 120);
  assert.match(
    document.querySelector("#dataStatus").textContent,
    /not a live feed/,
  );
  controller.dispose();
  dom.window.close();
});
