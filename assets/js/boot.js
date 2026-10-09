/* Tiny, dependency-free boot: a CDN or WebGL failure must never hide the site. */
(() => {
  const embedded = new URLSearchParams(location.search).get("embedded") === "1";
  document.documentElement.classList.toggle("embedded", embedded);
  let completed = false;
  const bar = () => document.querySelector("#loadProgress");
  window.PEVER_BOOT = {
    embedded,
    progress(value, label) {
      if (completed) return;
      if (bar()) bar().value = value;
      const caption = document.querySelector("#loadLabel");
      if (caption) caption.textContent = label;
    },
    finish() {
      completed = true;
      document.documentElement.classList.remove("is-loading");
      const loader = document.querySelector("#loader");
      if (loader) loader.hidden = true;
    },
  };
  if (!embedded) document.documentElement.classList.add("is-loading");
  // A slow CDN can continue loading after the readable HTML has been released.
  setTimeout(() => window.PEVER_BOOT.finish(), 8500);
})();
