/** Verifies the record editor labels its data and handles invalid JSON safely. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const editorRoot = path.join(__dirname, "../src/renderer/record-editor");

test("record editor is labeled and exposes validation feedback", () => {
  const html = fs.readFileSync(path.join(editorRoot, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(editorRoot, "index.js"), "utf8");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<label for="recordBody-label">Record Data<\/label>/);
  assert.match(html, /id="editorStatus"[^>]*aria-live="polite"/);
  assert.match(script, /try \{[\s\S]*JSON\.parse\(recordBody\.value\)/);
  assert.match(script, /The record is not valid JSON/);
});
