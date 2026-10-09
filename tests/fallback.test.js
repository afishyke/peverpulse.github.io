import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
test("reduced-motion and failed CDNs retain navigation, inspection, and the readable page", async () => {
  const dom = new JSDOM(
    readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    { url: "https://example.test/index.html", pretendToBeVisual: true },
  );
  const w = dom.window;
  for (const name of [
    "window",
    "document",
    "location",
    "history",
    "CustomEvent",
  ])
    globalThis[name] = name === "window" ? w : w[name];
  globalThis.innerWidth = 1200;
  globalThis.innerHeight = 800;
  globalThis.scrollY = 0;
  globalThis.matchMedia = (query) => ({
    matches: query.includes("reduced-motion"),
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(16), 1);
  globalThis.cancelAnimationFrame = clearTimeout;
  w.PEVER_BOOT = {
    embedded: false,
    progress() {},
    finish() {
      document.documentElement.classList.remove("is-loading");
    },
  };
  const dialog = document.querySelector("dialog");
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new w.Event("close"));
  };
  const append = document.head.append.bind(document.head);
  document.head.append = (element) => {
    append(element);
    if (element.tagName === "SCRIPT") queueMicrotask(() => element.onerror?.());
  };
  document.documentElement.classList.add("is-loading");
  await import("../assets/js/app.js");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(document.querySelector("#motionToggle").disabled);
  assert.equal(
    document.querySelector("#motionToggle").textContent,
    "Reduced motion",
  );
  document.querySelector("#menuToggle").click();
  assert.equal(document.querySelector("#worldMenu").hidden, false);
  document.querySelector("[data-inspect=gate]").click();
  assert.ok(dialog.open);
  assert.equal(
    document.querySelector("#artifactTitle").textContent,
    "The gate of possibility",
  );
  document.querySelector("#skipLoading").click();
  assert.equal(
    document.documentElement.classList.contains("is-loading"),
    false,
  );
  assert.equal(document.querySelectorAll(".portfolio-item").length, 7);
  assert.equal(document.body.classList.contains("custom-cursor"), false);
  w.dispatchEvent(new w.PageTransitionEvent("pagehide", { persisted: false }));
  dom.window.close();
});
