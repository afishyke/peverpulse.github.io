import test from "node:test";
import assert from "node:assert/strict";
import {
  historyURL,
  normalizeHistory,
  candleSummary,
  resolutionMinutes,
  fetchHistory,
} from "../assets/js/market.js";
const raw = {
  s: "ok",
  t: [200, 100],
  o: [12, 10],
  h: [15, 13],
  l: [11, 9],
  c: [14, 12],
  v: [240, 180],
};
test("history requests retain symbol, resolution, range and currency", () => {
  const url = historyURL({
    symbol: " m&m ",
    resolution: "1H",
    from: 100,
    to: 7300,
  });
  assert.equal(url.searchParams.get("symbol"), "M&M");
  assert.equal(url.searchParams.get("countback"), "2");
  assert.equal(url.searchParams.get("currencyCode"), "INR");
  assert.equal(url.searchParams.get("resolution"), "1H");
});
test("all seven original resolutions work", () =>
  assert.deepEqual(
    ["1m", "3m", "5m", "15m", "30m", "1H", "1D"].map(resolutionMinutes),
    [1, 3, 5, 15, 30, 60, 1440],
  ));
test("inverted, invalid and empty ranges are rejected", () => {
  for (const [from, to] of [
    [3, 1],
    [1, 1],
    [NaN, 2],
  ])
    assert.throws(() =>
      historyURL({ symbol: "TATASTEEL", resolution: "1D", from, to }),
    );
  assert.throws(() =>
    historyURL({ symbol: "", resolution: "1D", from: 1, to: 2 }),
  );
  assert.throws(() => resolutionMinutes("week"));
});
test("OHLCV values remain aligned when history arrives out of order", () => {
  const rows = normalizeHistory(raw);
  assert.deepEqual(rows[0], { t: 100, o: 10, h: 13, l: 9, c: 12, v: 180 });
  assert.equal(rows[1].c, 14);
  assert.equal(candleSummary(rows).change, ((14 - 12) / 12) * 100);
  assert.equal(candleSummary([rows[0]]).change, null);
});
test("provider errors, incomplete arrays and invalid candles fail explicitly", () => {
  assert.throws(() => normalizeHistory({ s: "no_data" }), /No data/);
  assert.throws(() => normalizeHistory({ ...raw, v: [1] }), /incomplete/);
  assert.throws(() => normalizeHistory({ ...raw, h: [0, 0] }), /invalid/);
  assert.throws(() => normalizeHistory({ ...raw, c: [NaN, 12] }), /invalid/);
});
test("duplicate provider timestamps do not produce duplicate bars", () =>
  assert.equal(normalizeHistory({ ...raw, t: [100, 100] }).length, 1));
test("HTTP failure never turns into made-up market data", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(
      fetchHistory({ symbol: "TATASTEEL", resolution: "1D", from: 1, to: 2 }),
      /503/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
