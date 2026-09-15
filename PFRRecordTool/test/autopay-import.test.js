/** Verifies documented AutoPay workbook sheets and column conversion. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");

const { loadAutoPayWorkbook } = require("../src/main/autopay/import.js");

test("loads Templates and Assignments sheets", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-autopay-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const filePath = path.join(directory, "autopay.xlsx");
  const workbook = new ExcelJS.Workbook();
  const templates = workbook.addWorksheet("Templates");
  templates.addRow(["Name", "Amount Option", "Frequency", "Apply Credits"]);
  templates.addRow(["Monthly", "Outstanding", "Monthly", "yes"]);
  const assignments = workbook.addWorksheet("Assignments");
  assignments.addRow([
    "Customer ID",
    "Template Name",
    "Payment Method",
    "Next Payment Date",
  ]);
  assignments.addRow([
    "CUST-1",
    "Monthly",
    "wallet-guid",
    new Date("2026-10-15T12:00:00.000Z"),
  ]);
  await workbook.xlsx.writeFile(filePath);

  const result = await loadAutoPayWorkbook(filePath);

  assert.deepEqual(result.templates, [
    {
      AmountOption: "Outstanding",
      ApplyCredits: "yes",
      Frequency: "Monthly",
      Name: "Monthly",
    },
  ]);
  assert.deepEqual(result.assignments, [
    {
      CustomerId: "CUST-1",
      NextPaymentDate: "2026-10-15T12:00:00.000Z",
      PaymentMethod: "wallet-guid",
      TemplateName: "Monthly",
    },
  ]);
});
