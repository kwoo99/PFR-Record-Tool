/** Displays the Chromium, Node.js, and Electron versions on primary pages. */
(() => {
  const target = document.querySelector("[data-runtime-versions]");
  if (!target) return;

  const versions = window.api?.versions;
  target.textContent = versions
    ? `Chrome v${versions.chrome()} · Node.js v${versions.node()} · Electron v${versions.electron()}`
    : "Runtime versions unavailable";
})();
