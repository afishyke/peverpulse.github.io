import { CONFIG, HOLDINGS } from "./config.js";
import { createAmbient } from "./audio.js";
import { setupCharts } from "./charts.js";

const boot = window.PEVER_BOOT || {
  embedded: false,
  progress() {},
  finish() {},
};
const embedded = boot.embedded,
  page = document.body.dataset.page;
const media = matchMedia("(prefers-reduced-motion: reduce)"),
  coarse = matchMedia("(pointer: coarse)");
let userPaused = false,
  world = null,
  worldFailed = false,
  audio = null,
  lenis = null,
  chartController = null,
  latestData = null;
let gsap = null,
  ScrollTrigger = null,
  motionContext = null,
  cameraTween = null;
let raf = 0,
  lastTime = 0,
  dirty = true,
  destroyed = false;
const state = { progress: 0 },
  pointer = { x: 0, y: 0, clientX: 0, clientY: 0, active: false };
const motionAllowed = () => !media.matches && !userPaused;
const reduced = () => !motionAllowed();
const scriptLoads = new Map();
export function loadScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptLoads.has(url)) return scriptLoads.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    const timeout = setTimeout(
      () => reject(new Error(`${globalName} timed out`)),
      15000,
    );
    script.onload = () => {
      clearTimeout(timeout);
      window[globalName]
        ? resolve(window[globalName])
        : reject(new Error(`${globalName} unavailable`));
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`${globalName} failed to load`));
    };
    document.head.append(script);
  });
  scriptLoads.set(url, promise);
  return promise;
}

// Fill story from one editable file; meaningful arrival/revelation copy exists in HTML too.
for (const element of document.querySelectorAll("[data-story]"))
  element.textContent =
    CONFIG.story[element.dataset.story] || element.textContent;
document
  .querySelector("#skipLoading")
  ?.addEventListener("click", () => boot.finish());
const setupPromise = setupCharts(loadScript, { embedded, reduced });
setupPromise
  .then((controller) => {
    chartController = controller;
    if (destroyed) controller?.dispose();
  })
  .catch((error) => {
    const status = document.querySelector("#dataStatus");
    if (status)
      status.textContent = `Unable to initialize the chart: ${error.message}`;
  });

function acceptData(detail) {
  if (
    !detail ||
    !Array.isArray(detail.rows) ||
    !detail.meta ||
    typeof detail.meta.symbol !== "string" ||
    !detail.rows.length ||
    detail.rows.length > 48
  )
    return;
  if (
    detail.rows.some(
      (row) =>
        !row ||
        !["t", "o", "h", "l", "c", "v"].every((key) =>
          Number.isFinite(row[key]),
        ),
    )
  )
    return;
  latestData = {
    rows: detail.rows,
    meta: {
      symbol: detail.meta.symbol.slice(0, 40),
      resolution: String(detail.meta.resolution).slice(0, 5),
      source:
        detail.meta.source === "Imported JSON"
          ? "Imported JSON"
          : "Moneycontrol",
    },
  };
  world?.setData(latestData.rows, latestData.meta);
  dirty = true;
  const caption = document.querySelector("#hologramCaption");
  if (caption)
    caption.textContent = `${latestData.meta.symbol} / ${latestData.meta.resolution} / ${latestData.meta.source.toUpperCase()} / THE SCULPTURE SHOWS THE LATEST ${latestData.rows.length} RETURNED CANDLES · VERTICAL HEIGHTS NORMALIZED TO THIS RANGE`;
}
window.addEventListener("pever:data", (event) => acceptData(event.detail));

if (embedded) {
  boot.finish();
  // Resize the frame to its content, never to its current viewport height.
  const root = document.querySelector(".terminal-main");
  let lastHeight = 0;
  const report = () => {
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (Math.abs(height - lastHeight) > 2) {
      lastHeight = height;
      parent.postMessage({ type: "pever:resize", height }, location.origin);
    }
  };
  const observer = new ResizeObserver(report);
  observer.observe(root);
  report();
  // A parent motion toggle also applies to chart animations inside each frame.
  window.addEventListener("message", (event) => {
    if (
      event.origin === location.origin &&
      event.source === parent &&
      event.data?.type === "pever:motion"
    ) {
      userPaused = Boolean(event.data.paused);
      document.body.classList.toggle("motion-paused", reduced());
      chartController?.setMotion(motionAllowed());
    }
  });
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) {
      destroyed = true;
      observer.disconnect();
      chartController?.dispose();
    }
  });
} else {
  startExperience();
}

async function startExperience() {
  const motionButton = document.querySelector("#motionToggle"),
    menuButton = document.querySelector("#menuToggle"),
    menu = document.querySelector("#worldMenu");
  const dialog = document.querySelector("#artifactDialog");
  let lastDialogOpener = null;
  function openArtifact(detail) {
    lastDialogOpener = document.activeElement;
    let title, body, href, link;
    const prefix = page === "journey" ? "" : "index.html";
    if (detail.kind === "gate") {
      title = "The gate of possibility";
      body = CONFIG.story.arrival;
      href = prefix + "#portfolio";
      link = "Enter the treasury ↗";
    } else if (detail.kind === "holding") {
      const h = detail.holding || HOLDINGS[0];
      title = h.name;
      body = `${h.symbol}\nOriginal holding: ₹${h.value.toLocaleString("en-IN")}\n${h.profit >= 0 ? "Profit" : "Loss"}: ₹${Math.abs(h.profit).toLocaleString("en-IN")}\n${((h.value / 400000) * 100).toFixed(2)}% of the original portfolio snapshot.`;
      href = prefix + "#portfolio";
      link = "See all holdings ↗";
    } else if (detail.kind === "candle" && detail.row) {
      const r = detail.row;
      title = detail.meta.symbol;
      body = `${new Date(r.t * 1000).toLocaleString("en-IN")}\nOpen: ₹${r.o} · High: ₹${r.h}\nLow: ₹${r.l} · Close: ₹${r.c}\nVolume: ${r.v.toLocaleString("en-IN")}\nSource: ${detail.meta.source} · ${detail.meta.resolution}`;
      href = prefix + "#chart";
      link = "Explore the complete chart ↗";
    } else if (detail.kind === "archive") {
      title = "The midnight archive";
      body = latestData
        ? `The structure holds ${latestData.rows.length} returned ${latestData.meta.symbol} candles. Each body runs from open to close; the thin wick marks low to high. Hover and select a candle to inspect its exact values.`
        : "Seven illuminated pillars represent the original portfolio holdings. Request price history below and the structure becomes a sculpture of the returned candles.";
      href = prefix + "#chart";
      link = "Reveal the data ↗";
    } else {
      title = "The crystal treasury";
      body =
        CONFIG.story.discovery +
        "\n\n₹4,00,000 across seven original holdings. The stone carries their history; the light reveals their proportions.";
      href = prefix + "#portfolio";
      link = "Explore the holdings ↗";
    }
    document.querySelector("#artifactTitle").textContent = title;
    document.querySelector("#artifactBody").textContent = body;
    const action = document.querySelector("#artifactLink");
    action.href = href;
    action.textContent = link;
    dialog.showModal();
    lenis?.stop();
  }
  dialog.addEventListener("close", () => {
    lenis?.start();
    lastDialogOpener?.focus?.({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (
        event.clientX < b.left ||
        event.clientX > b.right ||
        event.clientY < b.top ||
        event.clientY > b.bottom
      )
        dialog.close();
    }
  });
  document
    .querySelectorAll("[data-inspect]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openArtifact({ kind: button.dataset.inspect }),
      ),
    );
  function closeMenu() {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
  }
  menuButton.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    menuButton.setAttribute("aria-expanded", String(!menu.hidden));
    menuButton.setAttribute(
      "aria-label",
      menu.hidden ? "Open navigation" : "Close navigation",
    );
    if (!menu.hidden) menu.querySelector("a").focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (
      !menu.hidden &&
      !menu.contains(event.target) &&
      !menuButton.contains(event.target)
    )
      closeMenu();
  });
  audio = createAmbient(document.querySelector("#soundToggle"));

  const frames = [...document.querySelectorAll("iframe")];
  const sendMotion = () =>
    frames.forEach((frame) =>
      frame.contentWindow?.postMessage(
        { type: "pever:motion", paused: reduced() },
        location.origin,
      ),
    );
  frames.forEach((frame) => frame.addEventListener("load", sendMotion));
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const frame = frames.find((frame) => frame.contentWindow === event.source);
    if (!frame) return;
    if (
      event.data?.type === "pever:resize" &&
      Number.isFinite(event.data.height) &&
      event.data.height >= 200 &&
      event.data.height < 20000
    ) {
      const height = Math.ceil(event.data.height);
      if (frame.style.height !== height + "px") {
        frame.style.height = height + "px";
        lenis?.resize();
        ScrollTrigger?.refresh();
      }
    }
    if (event.data?.type === "pever:data") acceptData(event.data);
  });

  // One cursor trail, no canvas textures or allocations during each animation frame.
  const cursor = document.querySelector("#cursor"),
    trails = [];
  if (!coarse.matches) {
    for (let i = 0; i < 7; i++) {
      const dot = document.createElement("i");
      dot.className = "cursor-trail";
      dot.setAttribute("aria-hidden", "true");
      dot.hidden = true;
      document.body.append(dot);
      trails.push({ element: dot, x: 0, y: 0 });
    }
  }
  let hasPointer = false,
    down = null;
  const blocksPicking = (target) =>
    target?.closest(
      "a,button,input,select,summary,dialog,.site-header,.world-menu,.portfolio-grid,.stats-dashboard,.terminal-shell,.about-text,.member-block,.contact-content,.hero-copy",
    );
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
      pointer.x = (event.clientX / innerWidth) * 2 - 1;
      pointer.y = 1 - (event.clientY / innerHeight) * 2;
      pointer.active = !blocksPicking(event.target) && !dialog.open;
      hasPointer = true;
      if (!reduced() && !coarse.matches) {
        document.body.classList.add("custom-cursor");
        trails.forEach((item) => (item.element.hidden = false));
      }
      const tooltip = document.querySelector("#worldTooltip");
      tooltip.style.left =
        Math.min(event.clientX + 18, innerWidth - 220) + "px";
      tooltip.style.top = event.clientY + 20 + "px";
    },
    { passive: true },
  );
  const hidePointer = () => {
    hasPointer = false;
    pointer.active = false;
    document.body.classList.remove("custom-cursor");
    trails.forEach((item) => (item.element.hidden = true));
    document.querySelector("#worldTooltip").hidden = true;
  };
  document.addEventListener("pointerleave", hidePointer);
  window.addEventListener("blur", hidePointer);
  window.addEventListener(
    "pointerdown",
    (event) => {
      down = { x: event.clientX, y: event.clientY, scroll: scrollY };
    },
    { passive: true },
  );
  window.addEventListener("click", (event) => {
    if (
      !down ||
      blocksPicking(event.target) ||
      dialog.open ||
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6 ||
      Math.abs(scrollY - down.scroll) > 4
    )
      return;
    world?.click({
      x: (event.clientX / innerWidth) * 2 - 1,
      y: 1 - (event.clientY / innerHeight) * 2,
    });
  });

  function initMotion() {
    lenis?.destroy();
    lenis = null;
    motionContext?.revert();
    motionContext = null;
    cameraTween = null;
    document.body.classList.toggle("motion-paused", reduced());
    motionButton.setAttribute("aria-pressed", String(reduced()));
    motionButton.textContent = media.matches
      ? "Reduced motion"
      : userPaused
        ? "Resume motion"
        : "Pause motion";
    motionButton.disabled = media.matches;
    motionButton.title = media.matches
      ? "Motion is disabled by your device accessibility setting."
      : "";
    if (reduced()) hidePointer();
    if (motionAllowed() && window.Lenis && !coarse.matches)
      lenis = new window.Lenis({
        duration: CONFIG.motion.scrollDuration,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
      });
    if (lenis && ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
    if (gsap && ScrollTrigger && motionAllowed()) {
      motionContext = gsap.context(() => {
        if (page === "journey")
          cameraTween = gsap.fromTo(
            state,
            { progress: 0 },
            {
              progress: 1,
              ease: "none",
              scrollTrigger: {
                trigger: document.documentElement,
                start: 0,
                end: () =>
                  Math.max(
                    1,
                    document.documentElement.scrollHeight - innerHeight,
                  ),
                scrub: CONFIG.motion.cameraScrub,
                invalidateOnRefresh: true,
              },
            },
          );
        document.querySelectorAll("[data-reveal]").forEach((heading) => {
          if (!heading.dataset.split) {
            heading.setAttribute("aria-label", heading.textContent.trim());
            heading.innerHTML = heading.innerHTML
              .split(/<br\s*\/?\s*>/i)
              .map(
                (line) =>
                  `<span class="line-mask" aria-hidden="true"><span class="line-inner">${line}</span></span>`,
              )
              .join("");
            heading.dataset.split = "1";
          }
          gsap.from(heading.querySelectorAll(".line-inner"), {
            yPercent: 108,
            opacity: 0,
            duration: 1.2,
            ease: "power3.out",
            stagger: 0.15,
            scrollTrigger: { trigger: heading, start: "top 92%", once: true },
          });
        });
        document
          .querySelectorAll(
            ".content-realm .section-header,.quote-section blockquote,.about-text,.member-block,.contact-content",
          )
          .forEach((panel) =>
            gsap.from(panel, {
              y: 35,
              opacity: 0,
              duration: 1,
              ease: "power2.out",
              scrollTrigger: { trigger: panel, start: "top 95%", once: true },
            }),
          );
        document.querySelectorAll(".hologram-frame").forEach((panel) =>
          gsap.from(panel, {
            y: 60,
            opacity: 0.2,
            rotateX: 5,
            transformPerspective: 1300,
            duration: 1.2,
            scrollTrigger: {
              trigger: panel,
              start: "top 96%",
              end: "top 65%",
              scrub: 1,
            },
          }),
        );
      });
      ScrollTrigger.refresh();
    }
    dirty = true;
    chartController?.setMotion(motionAllowed());
    sendMotion();
  }
  motionButton.addEventListener("click", () => {
    userPaused = !userPaused;
    initMotion();
  });
  media.addEventListener("change", initMotion);
  coarse.addEventListener("change", initMotion);
  initMotion();
  const realms = [...document.querySelectorAll("[data-realm]")];
  let realmPositions = [],
    travelStops = [];
  const measure = () => {
    realmPositions = realms.map((element) => ({
      top: element.getBoundingClientRect().top + scrollY,
      label: element.dataset.realm,
    }));
    const maximum = Math.max(
      1,
      document.documentElement.scrollHeight - innerHeight,
    );
    travelStops = [{ at: 0, p: 0 }];
    for (const [selector, p] of [
      ["#portfolio", 0.2],
      ["#about", 0.34],
      ["#members", 0.4],
      ["#analysis", 0.48],
      [".revelation-vista", 0.58],
      ["#chart", 0.68],
      ["#contact", 0.92],
    ]) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const at = Math.max(
        0,
        Math.min(
          0.995,
          (element.getBoundingClientRect().top + scrollY - innerHeight * 0.2) /
            maximum,
        ),
      );
      if (at > travelStops.at(-1).at) travelStops.push({ at, p });
    }
    travelStops.push({ at: 1, p: 1 });
    dirty = true;
  };
  const travelProgress = (raw) => {
    if (page !== "journey") return raw;
    for (let i = 1; i < travelStops.length; i++) {
      const a = travelStops[i - 1],
        b = travelStops[i];
      if (raw <= b.at)
        return a.p + (b.p - a.p) * Math.max(0, (raw - a.at) / (b.at - a.at));
    }
    return 1;
  };
  const observer = new ResizeObserver(() => {
    measure();
    ScrollTrigger?.refresh();
  });
  observer.observe(document.querySelector("#main"));
  measure();
  function scrollUI() {
    const maximum = Math.max(
        1,
        document.documentElement.scrollHeight - innerHeight,
      ),
      progress = Math.min(1, Math.max(0, scrollY / maximum));
    document.querySelector("#journeyProgress").style.transform =
      `scaleY(${progress})`;
    document.querySelector("#journeyPercent").textContent = String(
      Math.round(progress * 100),
    ).padStart(2, "0");
    const current = realmPositions
      .filter((realm) => realm.top <= scrollY + innerHeight * 0.5)
      .at(-1);
    document.querySelector("#realmLabel").textContent =
      current?.label ||
      (page === "analysis"
        ? "The violet observatory"
        : page === "history"
          ? "The midnight archive"
          : "The gateway");
    if (!cameraTween)
      state.progress =
        page === "journey" ? progress : page === "analysis" ? 0.48 : 0.68;
    dirty = true;
  }
  window.addEventListener("scroll", scrollUI, { passive: true });
  scrollUI();
  function navigateTo(target) {
    if (dialog.open) dialog.close();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -95 });
    else target.scrollIntoView({ behavior: "auto", block: "start" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (
      !link ||
      link.target === "_blank" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      link.hasAttribute("download")
    )
      return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) {
      const target = document.getElementById(
        decodeURIComponent(url.hash.slice(1)),
      );
      if (target) {
        event.preventDefault();
        history.pushState(null, "", url.hash);
        navigateTo(target);
      }
    } else if (
      /\/(index|analysis|PEVERPICHART)\.html$/.test(url.pathname) &&
      motionAllowed()
    ) {
      event.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(() => location.assign(url.href), 280);
    }
  });
  window.addEventListener("pageshow", () => {
    document.body.classList.remove("leaving");
    dirty = true;
  });
  window.addEventListener(
    "resize",
    () => {
      world?.resize();
      measure();
      scrollUI();
      dirty = true;
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", () => {
    lastTime = 0;
    dirty = true;
  });
  function frame(now) {
    if (destroyed) return;
    if (document.hidden) return;
    const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
    lastTime = now;
    lenis?.raf(now);
    if (world && !worldFailed && (motionAllowed() || dirty)) {
      world.update({
        progress: travelProgress(state.progress),
        time: now / 1000,
        mouse: pointer,
        motion: motionAllowed(),
        dt,
      });
      dirty = false;
    }
    if (audio && motionAllowed()) audio.update(travelProgress(state.progress));
    if (hasPointer && motionAllowed() && !coarse.matches) {
      cursor.style.transform = `translate3d(${pointer.clientX}px,${pointer.clientY}px,0)`;
      let x = pointer.clientX,
        y = pointer.clientY;
      for (let i = 0; i < trails.length; i++) {
        const item = trails[i];
        item.x += (x - item.x) * 0.3;
        item.y += (y - item.y) * 0.3;
        item.element.style.transform = `translate3d(${item.x}px,${item.y}px,0)`;
        item.element.style.opacity = String((1 - i / trails.length) * 0.35);
        x = item.x;
        y = item.y;
      }
    }
  }
  const nativeTick = (now) => {
    frame(now);
    if (!destroyed) raf = requestAnimationFrame(nativeTick);
  };
  raf = requestAnimationFrame(nativeTick);
  const gsapTick = (time) => frame(time * 1000);
  boot.progress(20, "Growing stone and crystal");
  const worldPromise = import("./world.js")
    .then((module) => {
      if (destroyed) return;
      world = module.createWorld({
        canvas: document.querySelector("#world"),
        config: CONFIG,
        mobile: coarse.matches || innerWidth < 760,
        onInspect: openArtifact,
        onHover: (title) => {
          const tooltip = document.querySelector("#worldTooltip");
          tooltip.hidden = !title;
          if (title) tooltip.textContent = title + " · select to explore";
        },
        onContextLoss: () => {
          worldFailed = true;
          document.body.classList.remove("world-ready");
        },
      });
      if (latestData) world.setData(latestData.rows, latestData.meta);
      dirty = true;
      document.body.classList.add("world-ready");
      boot.progress(80, "Opening the observatory");
    })
    .catch((error) => {
      worldFailed = true;
      document.body.classList.add("world-fallback");
      console.info(
        "Pever Pulse: the HTML experience remains available; 3D could not start.",
        error.message,
      );
    });
  const motionPromise = Promise.allSettled([
    loadScript(CONFIG.cdn.gsap, "gsap").then(async (value) => {
      gsap = value;
      await loadScript(CONFIG.cdn.scrollTrigger, "ScrollTrigger");
      ScrollTrigger = window.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
    }),
    loadScript(CONFIG.cdn.lenis, "Lenis"),
  ]).then(() => {
    if (destroyed) return;
    if (gsap) {
      cancelAnimationFrame(raf);
      lastTime = 0;
      gsap.ticker.lagSmoothing(0);
      gsap.ticker.add(gsapTick);
    }
    initMotion();
    scrollUI();
  });
  Promise.allSettled([worldPromise, motionPromise]).then(() => {
    boot.progress(100, "The gateway is open");
    requestAnimationFrame(() => {
      boot.finish();
      ScrollTrigger?.refresh();
    });
  });
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    gsap?.ticker.remove(gsapTick);
    motionContext?.revert();
    lenis?.destroy();
    observer.disconnect();
    media.removeEventListener("change", initMotion);
    coarse.removeEventListener("change", initMotion);
    world?.dispose();
    audio?.dispose();
    chartController?.dispose();
  });
}
