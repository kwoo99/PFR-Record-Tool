/** Verifies renderer file references and confirmation-channel wiring. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");

const rendererRoot = path.join(__dirname, "../src/renderer");

function findHTMLFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findHTMLFiles(entryPath);
    }
    return entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

test("every local stylesheet and script referenced by a renderer exists", () => {
  for (const htmlPath of findHTMLFiles(rendererRoot)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const references = [...html.matchAll(/(?:href|src)="(\.[^"]+)"/g)].map(
      (match) => match[1],
    );

    for (const reference of references) {
      const assetPath = path.resolve(path.dirname(htmlPath), reference);
      assert.ok(
        fs.existsSync(assetPath),
        `${path.relative(rendererRoot, htmlPath)} references missing ${reference}`,
      );
    }
  }
});

test("every renderer uses the single PayFabric theme token source", () => {
  const themePath = path.join(rendererRoot, "shared/theme.css");
  const theme = fs.readFileSync(themePath, "utf8");
  assert.match(theme, /--brand-blue:\s*#1a80c3/i);
  assert.match(theme, /--brand-green:\s*#58b53b/i);

  for (const htmlPath of findHTMLFiles(rendererRoot)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    assert.match(
      html,
      /shared\/theme\.css/,
      `${path.relative(rendererRoot, htmlPath)} does not load the shared theme`,
    );
  }

  for (const directory of ["main", "autopay", "help", "record-editor"]) {
    const localCSS = fs.readFileSync(
      path.join(rendererRoot, directory, "index.css"),
      "utf8",
    );
    assert.doesNotMatch(localCSS, /:root\s*\{/);
  }
});

test("Electron renderer windows disable direct Node integration", () => {
  const mainProcessFiles = [
    path.join(__dirname, "../src/main/index.js"),
    path.join(__dirname, "../src/main/windows/manager.js"),
  ];
  for (const filePath of mainProcessFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(source, /nodeIntegration:\s*true/);
    assert.match(source, /nodeIntegration:\s*false/);
    assert.match(
      source,
      /sandbox:\s*false/,
      `${path.basename(filePath)} must keep the Node-powered preload available`,
    );
  }
});

test("every confirmation page names a valid confirm channel", () => {
  const confirmationRoot = path.join(rendererRoot, "confirmations");

  for (const htmlPath of findHTMLFiles(confirmationRoot)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const match = html.match(/data-confirm-channel="([^"]+)"/);

    assert.ok(match, `${path.basename(htmlPath)} has no confirm channel`);
    assert.ok(
      CHANNELS[match[1]],
      `${path.basename(htmlPath)} names unknown channel ${match[1]}`,
    );
  }
});
