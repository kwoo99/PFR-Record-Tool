/** Verifies contextual help remains discoverable to sighted and screen-reader users. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mainHTML = fs.readFileSync(
  path.join(__dirname, "../src/renderer/main/index.html"),
  "utf8",
);
const normalizedHTML = mainHTML.replace(/\s+/g, " ");

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
  const describedByIds = [
    ...mainHTML.matchAll(
      /class="help-tip__trigger"[\s\S]*?aria-describedby="([^"]+)"/g,
    ),
  ].map((match) => match[1]);

  assert.equal(describedByIds.length, 5);
  assert.equal(new Set(describedByIds).size, describedByIds.length);

  for (const id of describedByIds) {
    assert.match(
      normalizedHTML,
      new RegExp(`id="${id}" class="help-tip__content" role="tooltip"`),
    );
  }
});

test("destructive and bulk-loading help states the scope of each action", () => {
  assert.match(normalizedHTML, /It does not delete or change any customers\./);
  assert.match(
    normalizedHTML,
    /This setting applies to every bulk delete action\./,
  );
  assert.match(normalizedHTML, /View\/change opens only the first ID\./);
});
