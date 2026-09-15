/**
 * AutoPay skeleton workbook generator.
 * Uses the same Excel engine as the importer and the shared schema used by Help,
 * ensuring every downloaded file can be read back by this application.
 */
const ExcelJS = require("exceljs");

const schema = require("../../shared/autopay-workbook-schema.js");

const COLORS = Object.freeze({
  header: "FF4472C4",
  headerBorder: "FF2F5597",
});

function columnLetter(index) {
  let result = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function addListValidation(sheet, fields, fieldName) {
  const field = schema.field(fieldName);
  const columnIndex = fields.indexOf(fieldName) + 1;
  if (!field?.options?.length || columnIndex === 0) return;

  sheet.dataValidations.add(
    `${columnLetter(columnIndex)}2:${columnLetter(columnIndex)}1000`,
    {
      allowBlank: true,
      error: `Choose one of: ${field.options.join(", ")}`,
      errorStyle: "error",
      formulae: [`"${field.options.join(",")}"`],
      showErrorMessage: true,
      type: "list",
    },
  );
}

function addSheet(workbook, name, fields, rows = []) {
  const sheet = workbook.addWorksheet(name, {
    properties: { tabColor: { argb: name === "Templates" ? "FF1362E2" : "FF6A7F91" } },
    views: [
      {
        state: "frozen",
        xSplit: name === "Templates" ? 1 : 2,
        ySplit: 1,
      },
    ],
  });
  sheet.views = [{ showGridLines: true, state: "frozen", xSplit: name === "Templates" ? 1 : 2, ySplit: 1 }];
  sheet.columns = fields.map((field) => ({
    header: field,
    key: field,
    width: Math.min(24, Math.max(14, field.length + 3)),
  }));
  sheet.autoFilter = `A1:${columnLetter(fields.length)}1`;

  const header = sheet.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { fgColor: { argb: COLORS.header }, pattern: "solid", type: "pattern" };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
    cell.border = {
      bottom: { color: { argb: COLORS.headerBorder }, style: "thin" },
      right: { color: { argb: "FFFFFFFF" }, style: "thin" },
    };
  });
  if (rows.length) sheet.addRows(rows);

  for (const fieldName of [
    "AmountOption",
    "FixedAmountOption",
    "CurrencyOption",
    "Frequency",
    "StartOption",
    "InvoiceTypeOption",
    "ApplyCredits",
  ]) {
    addListValidation(sheet, fields, fieldName);
  }

  const fixedAmountColumn = fields.indexOf("FixedAmount") + 1;
  if (fixedAmountColumn > 0) {
    sheet.getColumn(fixedAmountColumn).numFmt = "0.00";
    sheet.dataValidations.add(
      `${columnLetter(fixedAmountColumn)}2:${columnLetter(fixedAmountColumn)}1000`,
      {
        allowBlank: true,
        error: "FixedAmount must be greater than zero.",
        formulae: [0],
        operator: "greaterThan",
        showErrorMessage: true,
        type: "decimal",
      },
    );
  }

  const intervalColumn = fields.indexOf("FrequencyInterval") + 1;
  if (intervalColumn > 0) {
    sheet.dataValidations.add(
      `${columnLetter(intervalColumn)}2:${columnLetter(intervalColumn)}1000`,
      {
        allowBlank: true,
        error: "FrequencyInterval must be a positive whole number.",
        formulae: [1, 1000],
        operator: "between",
        showErrorMessage: true,
        type: "whole",
      },
    );
  }

  const dateColumn = fields.indexOf("NextPaymentDate") + 1;
  if (dateColumn > 0) sheet.getColumn(dateColumn).numFmt = "mm/dd/yyyy";
  return sheet;
}

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PFR Record Tool";
  workbook.created = new Date("2026-09-10T00:00:00.000Z");
  return workbook;
}

function createAutoPayWorkbook({ assignments = [] } = {}) {
  const workbook = createWorkbook();
  addSheet(workbook, "Templates", schema.templateFields);
  addSheet(workbook, "Assignments", schema.assignmentFields, assignments);
  return workbook;
}

function createCustomerExportWorkbook(rows) {
  const workbook = createWorkbook();
  const fields = [
    "CustomerId",
    "Name",
    "Email",
    "CurrencyCode",
    "InvoiceBalance",
    "PastDueBalance",
    "CreditBalance",
    "ActiveUsers",
    "AutoPayStatus",
    "NextAutoPay",
    "WalletGuid",
    "WalletSource",
  ];
  const sheet = addSheet(workbook, "Customer Data", fields, rows);
  const headers = [
    "Customer ID",
    "Name",
    "Email",
    "Currency",
    "Invoice Balance",
    "Past-Due Balance",
    "Credit Balance",
    "Active Users",
    "AutoPay Status",
    "Next AutoPay",
    "Wallet GUID",
    "Wallet Source",
  ];
  headers.forEach((header, index) => {
    sheet.getRow(1).getCell(index + 1).value = header;
  });
  sheet.getColumn("Name").width = 24;
  sheet.getColumn("Email").width = 30;
  sheet.getColumn("WalletGuid").width = 40;
  sheet.getColumn("WalletSource").width = 24;
  for (const field of ["InvoiceBalance", "PastDueBalance", "CreditBalance"]) {
    sheet.getColumn(field).numFmt = "#,##0.00";
  }
  sheet.getColumn("NextAutoPay").numFmt = "mm/dd/yyyy";
  addSheet(workbook, "Templates", schema.templateFields);
  addSheet(
    workbook,
    "Assignments",
    schema.assignmentFields,
    rows.map((row) => ({
      Currency: row.CurrencyCode,
      CustomerId: row.CustomerId,
      PaymentMethod: row.WalletGuid,
    })),
  );
  return workbook;
}

async function writeAutoPayWorkbook(filePath) {
  const workbook = createAutoPayWorkbook();
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function writeCustomerExportWorkbook(filePath, rows) {
  const workbook = createCustomerExportWorkbook(rows);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = {
  createAutoPayWorkbook,
  createCustomerExportWorkbook,
  writeAutoPayWorkbook,
  writeCustomerExportWorkbook,
};
