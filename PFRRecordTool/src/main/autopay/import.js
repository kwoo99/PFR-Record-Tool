/**
 * AutoPay Excel workbook reader.
 * Accepts a Templates sheet for reusable configurations and an Assignments sheet
 * for customer-specific values. The vault remains read-only; only chosen files
 * are read and no workbook content is persisted by the app.
 */
const ExcelJS = require("exceljs");
const workbookSchema = require("../../shared/autopay-workbook-schema.js");

function normalizedHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(cell) {
  const value = cell.value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    if (value.result !== undefined) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if (value.text !== undefined) return value.text;
  }
  return value;
}

function readSheet(sheet, fields) {
  if (!sheet || sheet.rowCount < 2) return [];
  const recognized = new Map(fields.map((field) => [normalizedHeader(field), field]));
  for (const [alias, field] of Object.entries(workbookSchema.aliases)) {
    if (fields.includes(field)) recognized.set(normalizedHeader(alias), field);
  }
  const headerRow = sheet.getRow(1);
  const columns = new Map();
  headerRow.eachCell((cell, column) => {
    const field = recognized.get(normalizedHeader(cellValue(cell)));
    if (field) columns.set(column, field);
  });

  if (!columns.size) {
    throw new Error(`${sheet.name} has no recognized AutoPay columns`);
  }

  const rows = [];
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    const record = {};
    for (const [column, field] of columns) {
      const value = cellValue(row.getCell(column));
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        record[field] = value;
      }
    }
    if (Object.keys(record).length) rows.push(record);
  }
  return rows;
}

async function loadAutoPayWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const templatesSheet = workbook.worksheets.find(
    (sheet) => normalizedHeader(sheet.name) === "templates",
  );
  const assignmentsSheet = workbook.worksheets.find(
    (sheet) => normalizedHeader(sheet.name) === "assignments",
  );

  const templates = templatesSheet
    ? readSheet(templatesSheet, workbookSchema.templateFields)
    : [];
  const fallbackAssignmentSheet =
    assignmentsSheet ?? (!templatesSheet ? workbook.worksheets[0] : undefined);
  const assignments = fallbackAssignmentSheet
    ? readSheet(fallbackAssignmentSheet, workbookSchema.assignmentFields)
    : [];

  if (!templates.length && !assignments.length) {
    throw new Error(
      "Workbook must contain a Templates or Assignments sheet with at least one data row",
    );
  }
  return { assignments, templates };
}

module.exports = { loadAutoPayWorkbook };
