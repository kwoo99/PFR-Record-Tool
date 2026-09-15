/** Verifies contextual help remains discoverable to sighted and screen-reader users. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mainHTML = fs.readFileSync(
  path.join(__dirname, "../src/renderer/main/index.html"),
  "utf8",
);
const autoPayHTML = fs.readFileSync(
  path.join(__dirname, "../src/renderer/autopay/index.html"),
  "utf8",
);
const mainConfiguration = fs.readFileSync(
  path.join(__dirname, "../src/renderer/main/configuration.js"),
  "utf8",
);
const normalizedHTML = mainHTML.replace(/\s+/g, " ");

function assertTooltips(html, expectedCount) {
  const normalized = html.replace(/\s+/g, " ");
  const describedByIds = [
    ...html.matchAll(
      /class="help-tip__trigger"[\s\S]*?aria-describedby="([^"]+)"/g,
    ),
  ].map((match) => match[1]);

  assert.equal(describedByIds.length, expectedCount);
  assert.equal(new Set(describedByIds).size, describedByIds.length);

  for (const id of describedByIds) {
    assert.match(
      normalized,
      new RegExp(`id="${id}" class="help-tip__content" role="tooltip"`),
    );
  }
}

test("Single record explains its supported actions", () => {
  assert.match(
    normalizedHTML,
    /Find one customer, invoice, or payment by ID to view or change it\./,
  );
  assert.match(
    normalizedHTML,
    /customer-only and full-account delete actions/,
  );
});

test("every info trigger points to an existing tooltip", () => {
  assertTooltips(mainHTML, 5);
  assertTooltips(autoPayHTML, 8);
});

test("destructive and bulk-loading help states the scope of each action", () => {
  assert.match(normalizedHTML, /It does not delete or change any customers\./);
  assert.match(
    normalizedHTML,
    /This setting applies to every bulk delete action\./,
  );
  assert.match(normalizedHTML, /View\/change opens only the first ID\./);
});

test("Records and AutoPay share a stable header shell with runtime versions", () => {
  for (const [name, html] of [
    ["Records", mainHTML],
    ["AutoPay", autoPayHTML],
  ]) {
    assert.match(html, /class="app-header__primary"/, `${name} header differs`);
    assert.match(html, /data-runtime-versions/, `${name} hides runtime versions`);
    assert.match(html, /shared\/app-shell\.css/);
    assert.match(html, /shared\/runtime-versions\.js/);
  }
});

test("Records shows the connected portal timezone", () => {
  assert.match(mainHTML, /id="timezoneSummary"/);
  assert.match(mainConfiguration, /GET_CONNECTION_STATUS/);
  assert.match(mainConfiguration, /renderConnectionSummary/);
});
