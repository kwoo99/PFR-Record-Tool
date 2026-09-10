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
