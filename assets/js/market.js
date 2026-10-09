/** Shared data boundary. No API keys, proxy, invented candles, or build service. */
export const ENDPOINT =
  "https://priceapi.moneycontrol.com/techCharts/indianMarket/stock/history";
export const RESOLUTIONS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1H",
  "1D",
]);

export function resolutionMinutes(resolution) {
  if (!RESOLUTIONS.has(resolution))
    throw new Error("Choose a supported resolution.");
  return (
    parseInt(resolution, 10) *
    (resolution.endsWith("H") ? 60 : resolution.endsWith("D") ? 1440 : 1)
  );
}

export function historyURL({ symbol, resolution, from, to, countback }) {
  symbol = String(symbol).trim().toUpperCase();
  if (!/^[A-Z0-9&_.:-]{1,40}$/.test(symbol))
    throw new Error("Enter a valid NSE/BSE symbol, such as TATASTEEL.");
  const minutes = resolutionMinutes(resolution);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    throw new Error(
      "The start date and time must be earlier than the end date and time.",
    );
  }
  const bars =
    countback ?? Math.max(1, Math.ceil((to - from) / (minutes * 60)));
  if (!Number.isSafeInteger(bars) || bars < 1)
    throw new Error("Invalid number of requested bars.");
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    symbol,
    resolution,
    from: Math.floor(from),
    to: Math.floor(to),
    countback: bars,
    currencyCode: "INR",
  });
  return url;
}

export function normalizeHistory(data) {
  if (data?.s === "no_data")
    throw new Error("No data is available for this symbol and time range.");
  const keys = ["t", "o", "h", "l", "c", "v"];
  if (
    !data ||
    !keys.every((key) => Array.isArray(data[key])) ||
    !data.t.length
  ) {
    throw new Error("The provider returned no usable price history.");
  }
  if (!keys.every((key) => data[key].length === data.t.length))
    throw new Error("The provider returned incomplete price history.");
  const rows = data.t.map((time, i) => ({
    t: Number(time),
    o: Number(data.o[i]),
    h: Number(data.h[i]),
    l: Number(data.l[i]),
    c: Number(data.c[i]),
    v: Number(data.v[i]),
  }));
  if (
    rows.some(
      (row) =>
        keys.some((key) => !Number.isFinite(row[key])) ||
        row.t <= 0 ||
        row.v < 0 ||
        row.h < Math.max(row.o, row.c, row.l) ||
        row.l > Math.min(row.o, row.c, row.h),
    )
  ) {
    throw new Error("The provider returned invalid candle values.");
  }
  rows.sort((a, b) => a.t - b.t);
  return rows.filter((row, i) => i === 0 || row.t !== rows[i - 1].t);
}

export async function fetchHistory(query, signal) {
  const response = await fetch(historyURL(query), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(
      `The data provider returned HTTP ${response.status}. Please try again later.`,
    );
  return normalizeHistory(await response.json());
}

export function candleSummary(rows) {
  if (!rows.length) return null;
  const last = rows.at(-1);
  const previous = rows.at(-2);
  return {
    ...last,
    change:
      previous && previous.c !== 0
        ? ((last.c - previous.c) / previous.c) * 100
        : null,
  };
}
