/** EDIT HERE: palette, travel feel, rendering budget, and the four story beats. */
export const CONFIG = {
  colors: {
    dawn: {
      sky: "#24353b",
      horizon: "#a17c60",
      fog: "#42585b",
      light: "#ffe1ac",
    },
    dusk: {
      sky: "#171329",
      horizon: "#584269",
      fog: "#342d51",
      light: "#c8a5ff",
    },
    night: {
      sky: "#060e20",
      horizon: "#173247",
      fog: "#122637",
      light: "#8ff5e4",
    },
    crystal: "#86ddd3",
    vein: "#b5fff1",
    gold: "#e6c28c",
    stone: "#303b42",
  },
  motion: {
    scrollDuration: 1.15,
    cameraScrub: 0.8,
    mouseTilt: 0.65,
    driftSpeed: 0.22,
  },
  quality: {
    desktopDPR: 1.5,
    mobileDPR: 1,
    desktopParticles: 1100,
    mobileParticles: 220,
    bloom: 0.65,
  },
  story: {
    arrival:
      "Beyond the noise lies a city built from possibility. Follow the light. Find the value hidden in its peaks.",
    discovery:
      "Each crystal carries a fragment of the whole. Step closer: conviction, patience, and precision give the city its shape.",
    revelation:
      "At the observatory, the mist lifts. The past becomes a pattern, and every movement leaves a trace.",
    closing:
      "The horizon is still unwritten. Take what you have discovered, and build what comes next.",
  },
  // Relative paths keep both user and project GitHub Pages deployments working.
  cdn: {
    gsap: "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js",
    scrollTrigger:
      "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js",
    lenis: "https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js",
    chart: "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js",
    apex: "https://cdn.jsdelivr.net/npm/apexcharts@3.54.1/dist/apexcharts.min.js",
  },
};

// The original site's figures, preserved verbatim. These are a static snapshot.
export const HOLDINGS = [
  {
    name: "Reliance Industries",
    short: "Reliance",
    symbol: "RELIANCE",
    value: 100000,
    profit: 12000,
    color: "#bce8dd",
  },
  {
    name: "State Bank of India",
    short: "SBIN",
    symbol: "SBIN",
    value: 150000,
    profit: 25000,
    color: "#d9b783",
  },
  {
    name: "HDFC Bank",
    short: "HDFC Bank",
    symbol: "HDFCBANK",
    value: 60000,
    profit: -5000,
    color: "#9696cd",
  },
  {
    name: "Tata Steel",
    short: "Tata Steel",
    symbol: "TATASTEEL",
    value: 40000,
    profit: 8000,
    color: "#75bcbd",
  },
  {
    name: "Infosys",
    short: "Infosys",
    symbol: "INFY",
    value: 30000,
    profit: 12000,
    color: "#b2c29a",
  },
  {
    name: "ICICI Bank",
    short: "ICICI Bank",
    symbol: "ICICIBANK",
    value: 15000,
    profit: 6000,
    color: "#ca9896",
  },
  {
    name: "Adani Power",
    short: "Adani Power",
    symbol: "ADANIPOWER",
    value: 5000,
    profit: -2000,
    color: "#8c9ead",
  },
];
