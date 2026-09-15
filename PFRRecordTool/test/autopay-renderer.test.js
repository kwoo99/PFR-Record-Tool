/** Verifies the AutoPay workspace exposes the planned workflows and guardrails. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs
  .readFileSync(
    path.join(__dirname, "../src/renderer/autopay/index.html"),
    "utf8",
  )
  .replace(/\s+/g, " ");
const bulkActions = fs.readFileSync(
  path.join(__dirname, "../src/renderer/autopay/bulk-actions.js"),
  "utf8",
);
const customerController = fs.readFileSync(
  path.join(__dirname, "../src/renderer/autopay/customers.js"),
  "utf8",
);

test("AutoPay workspace includes filtering, selection, and every contract source", () => {
  assert.match(html, /AutoPay Status/);
  assert.match(html, /Customer ID Exact Match/);
  assert.match(html, /Name Exact Match/);
  assert.match(html, /Email Exact Match/);
  assert.match(customerController, /customerId: value\("customerIdFilter"\)/);
  assert.match(customerController, /name: value\("nameFilter"\)/);
  assert.match(customerController, /email: value\("emailFilter"\)/);
  assert.doesNotMatch(customerController, /customerIdContains|nameContains|emailContains/);
  assert.match(html, /On AutoPay/);
  assert.match(html, /Not on AutoPay/);
  assert.match(html, /id="timezoneSummary"/);
  assert.match(html, /Select All Matching Results/);
  assert.match(html, /Existing Portal Template/);
  assert.match(html, /JSON Configuration/);
  assert.match(html, /Excel Workbook/);
});

test("AutoPay workspace includes individual and resumable bulk controls", () => {
  assert.match(html, /Customer Contract/);
  assert.match(html, /Remove This Contract/);
  assert.match(html, /Apply AutoPay to Selected/);
  assert.match(html, /Remove AutoPay from Selected/);
  assert.match(html, />Continue</);
  assert.match(html, /Retry Temporary Failures/);
  assert.match(html, /AutoPay Progress/);
  assert.match(html, /id="bulkSchedulePreview"/);
  assert.match(html, /id="contractSchedulePreview"/);
  assert.match(html, /id="bulkSelectionSummary"/);
  assert.doesNotMatch(
    html,
    /id="pauseAutoPayButton" class="danger"/,
  );
  assert.match(html, /PayFabric processes the contract at 12:00 AM \(00:00\)/);
  assert.match(bulkActions, /renderResults\(progress\.results\)/);
  assert.match(bulkActions, /AUTOPAY_CLEAR_RESULTS/);
  assert.doesNotMatch(bulkActions, /childElementCount > 300/);
});

test("AutoPay customer selection can export wallet-enriched customer data", () => {
  assert.match(html, /id="exportSelectedCustomersButton"/);
  assert.match(html, /Export Selected Customers/);
  assert.match(bulkActions, /AUTOPAY_DOWNLOAD_WORKBOOK/);
  const customers = fs.readFileSync(
    path.join(__dirname, "../src/renderer/autopay/customers.js"),
    "utf8",
  );
  assert.match(customers, /AUTOPAY_EXPORT_CUSTOMERS/);
  assert.match(customers, /Retrieving wallet GUIDs/);
});

test("workbook downloads do not show an unnecessary success message", () => {
  assert.doesNotMatch(bulkActions, /fileName} saved successfully/);
  assert.doesNotMatch(bulkActions, /Portal template saved successfully/);
  assert.match(bulkActions, /Could not save the workbook/);
});
