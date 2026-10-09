import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { JSDOM } from "jsdom";
import { HOLDINGS } from "../assets/js/config.js";
const root = resolve(import.meta.dirname, "..");
const names = ["index.html", "analysis.html", "PEVERPICHART.html"];
for (const name of names)
  test(`${name}: unique IDs, local assets, and navigation targets`, () => {
    const doc = new JSDOM(readFileSync(resolve(root, name), "utf8")).window
      .document;
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length, "Duplicate IDs");
    for (const el of doc.querySelectorAll("[src],link[href],a[href]")) {
      const raw = el.getAttribute("src") || el.getAttribute("href");
      if (!raw || /^(https?:|mailto:|tel:|data:)/.test(raw)) continue;
      const url = new URL(raw, "https://example.test/" + name),
        path = resolve(root, url.pathname.slice(1));
      assert.ok(existsSync(path), `Missing ${raw}`);
      if (url.hash && path.endsWith(".html")) {
        const target = new JSDOM(readFileSync(path, "utf8")).window.document;
        assert.ok(
          target.getElementById(url.hash.slice(1)),
          `Missing anchor ${raw}`,
        );
      }
    }
    assert.ok(
      doc
        .querySelector("meta[name=viewport]")
        .content.includes("width=device-width"),
    );
    assert.ok(
      !doc
        .querySelector("meta[name=viewport]")
        .content.includes("user-scalable=no"),
    );
    const imports = JSON.parse(
      doc.querySelector("script[type=importmap]").textContent,
    ).imports;
    assert.ok(imports.three.includes("three@0.170.0"));
    assert.ok(imports["three/addons/"].includes("three@0.170.0"));
  });
test("all original holdings, team names, quotes, contact details and local portraits survive", () => {
  const doc = new JSDOM(readFileSync(resolve(root, "index.html"), "utf8"))
      .window.document,
    text = doc.body.textContent.replace(/\s+/g, " ");
  for (const h of HOLDINGS) {
    assert.ok(text.includes(h.name));
    assert.ok(text.includes(h.value.toLocaleString("en-IN")));
  }
  for (const phrase of [
    "Hamdan Haroon",
    "Arjun Renjeev",
    "Kenady B Paul",
    "Akash Ani",
    "YOU SHOULNT CLIMB A MOUNTAIN",
    "A CUPCAKE IS A CAKE ITSELF",
    "GRAPES SOUR WHEN ITS OLD",
    "LOOSE MONEY I WILL BE FORGIVING",
    "peverpulse@gmail.com",
    "+91 97787 38614",
    "3,40,000",
    "+60,000 (17.6%)",
    "+5,400 (1.35%)",
    "subsidiary of PeverService",
    "cryptocurrencies, forex, and bonds",
  ])
    assert.ok(text.includes(phrase), phrase);
  assert.equal(doc.querySelectorAll(".member-portrait img").length, 4);
  assert.equal(
    HOLDINGS.reduce((s, h) => s + h.value, 0),
    400000,
  );
  assert.equal(doc.querySelectorAll("iframe[title]").length, 2);
  assert.ok(doc.querySelector("#soundToggle[aria-pressed=false]"));
});
