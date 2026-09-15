/** Keeps headings, labels, and actions consistently capitalized across workspaces. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function renderer(name) {
  return fs
    .readFileSync(path.join(__dirname, `../src/renderer/${name}/index.html`), "utf8")
    .replace(/\s+/g, " ");
}

test("Records controls use consistent title capitalization", () => {
  const html = renderer("main");

  assert.match(html, /Choose CSV File/);
  assert.match(html, /Fetch All Customers from Portal/);
  assert.match(html, /Deletion Progress/);
  assert.match(html, /Pause Deletion/);
});

test("AutoPay and Help labels use consistent title capitalization", () => {
  const autoPay = renderer("autopay");
  const help = renderer("help");

  assert.match(autoPay, /AutoPay Management/);
  assert.match(autoPay, /Customer ID Exact Match/);
  assert.match(autoPay, /Bulk AutoPay Action/);
  assert.match(autoPay, /Download Template/);
  assert.match(help, /AutoPay Workbook Reference/);
  assert.match(help, /Search Columns and Options/);
});
