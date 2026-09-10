/** Verifies CSV record extraction independently from renderer state. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const { loadData } = require("../src/main/csv/records.js");

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("loadData returns the record IDs and detected CSV column", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-records-"));
  temporaryDirectories.push(directory);
  const csvPath = path.join(directory, "customers.csv");
  fs.writeFileSync(csvPath, "CustomerId\nCUST-001\nCUST-002\n");

  const result = await loadData(csvPath);

  assert.deepEqual(result, {
    recordList: ["CUST-001", "CUST-002"],
    recordType: "CustomerId",
  });
});
