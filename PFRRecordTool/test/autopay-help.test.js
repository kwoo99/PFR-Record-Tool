/** Verifies the shared workbook schema, downloadable skeleton, and Help surface. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");

const CHANNELS = require("../src/shared/channels.js");
const schema = require("../src/shared/autopay-workbook-schema.js");
const {
  writeAutoPayWorkbook,
} = require("../src/main/autopay/workbook-template.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

const rendererRoot = path.join(__dirname, "../src/renderer");

test("every supported workbook column has an object-reference definition", () => {
  const fieldNames = new Set(schema.fields.map((field) => field.name));
  for (const column of [
    ...schema.templateFields,
    ...schema.assignmentFields,
  ]) {
    assert.ok(fieldNames.has(column), `${column} has no field definition`);
  }

  assert.deepEqual(schema.field("AmountOption").options, [
    "Outstanding",
    "PastDue",
    "FixedAmount",
  ]);
  assert.deepEqual(schema.field("StartOption").options, [
    "None",
    "DayOfTheMonth",
    "DayOfTheWeek",
    "NextDay",
    "UserChoice",
  ]);
});

test("downloadable workbook contains complete Templates and Assignments headers", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-workbook-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const workbookPath = path.join(directory, "AutoPay.xlsx");
  await writeAutoPayWorkbook(workbookPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  assert.deepEqual(
    workbook.getWorksheet("Templates").getRow(1).values.slice(1),
    schema.templateFields,
  );
  assert.deepEqual(
    workbook.getWorksheet("Assignments").getRow(1).values.slice(1),
    schema.assignmentFields,
  );

  for (const sheetName of ["Templates", "Assignments"]) {
    const sheet = workbook.getWorksheet(sheetName);
    assert.equal(sheet.views[0].showGridLines, true);
    assert.equal(sheet.getCell("A1").fill.fgColor.argb, "FF4472C4");
    assert.equal(sheet.getCell("A2").fill, undefined);
  }
});

test("Help window exposes the AutoPay workbook object reference", () => {
  const html = fs.readFileSync(path.join(rendererRoot, "help/index.html"), "utf8");

  assert.match(html, /AutoPay Workbook Reference/);
  assert.match(html, /id="referenceSearch"/);
  assert.match(html, /autopay-workbook-schema\.js/);
  assert.doesNotMatch(html, /id="downloadWorkbookButton"/);
});

test("Help window includes a navigable guide for core record and AutoPay workflows", () => {
  const html = fs.readFileSync(path.join(rendererRoot, "help/index.html"), "utf8");
  const script = fs.readFileSync(path.join(rendererRoot, "help/index.js"), "utf8");

  for (const section of [
    "Connect Safely",
    "View or Change a Single Record",
    "Load Customer Lists",
    "Run and Continue Bulk Deletions",
    "Find and Select AutoPay Customers",
    "Manage an Individual Contract",
    "Run a Bulk AutoPay Action",
    "Use Workbooks and Customer Exports",
    "Troubleshooting",
  ]) {
    assert.match(html, new RegExp(section));
  }
  assert.match(html, /data-topic="guide"/);
  assert.match(html, /data-topic="workbook"/);
  assert.match(script, /function showTopic/);
});

test("AutoPay workspace owns the workbook template download", () => {
  const html = fs.readFileSync(path.join(rendererRoot, "autopay/index.html"), "utf8");

  assert.match(html, /Excel Workbook Template/);
  assert.match(html, /id="downloadWorkbookButton"/);
  assert.match(html, /Download Template/);
});

test("download workflow saves the generated skeleton and opens Help", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-help-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const destination = path.join(directory, "AutoPay.xlsx");
  const harness = createIPCHarness({ selectedSaveFilePath: destination });

  const result = await harness.handlers.get(
    CHANNELS.AUTOPAY_DOWNLOAD_WORKBOOK,
  )();
  await harness.handlers.get(CHANNELS.OPEN_HELP)();

  assert.deepEqual(result, { fileName: "AutoPay.xlsx" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(destination);
  assert.ok(workbook.getWorksheet("Templates"));
  assert.ok(workbook.getWorksheet("Assignments"));
  assert.equal(harness.helpOpenCount(), 1);
});
