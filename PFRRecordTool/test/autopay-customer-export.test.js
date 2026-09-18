/** Verifies selected customer exports retain every row and resolve wallets safely. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");

const { prepareCustomerExport } = require("../src/main/autopay/customer-export.js");
const { createCustomerExportWorkbook } = require("../src/main/autopay/workbook-template.js");
const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("large wallet exports preserve order and use six bounded workers", async () => {
  const customers = Array.from({ length: 24 }, (_, index) => ({
    CurrencyCode: "USD",
    CustomerId: `CUST-${index + 1}`,
    HasAutoPay: false,
  }));
  let active = 0;
  let maximumActive = 0;
  const progress = [];

  const rows = await prepareCustomerExport(customers, {
    getAutoPayContract: async () => ({ data: null, status: 404 }),
    getDefaultPaymentMethod: async (customerId) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return { data: { PaymentMethodGuid: `WALLET-${customerId}` } };
    },
    maxConcurrency: 20,
    onProgress: (snapshot) => progress.push(snapshot),
  });

  assert.equal(maximumActive, 6);
  assert.deepEqual(
    rows.map((row) => row.CustomerId),
    customers.map((customer) => customer.CustomerId),
  );
  assert.equal(rows[0].WalletGuid, "WALLET-CUST-1");
  assert.deepEqual(progress.at(-1), { completed: 24, total: 24 });
});

test("customer export prefers the contract wallet and falls back to the default wallet", async () => {
  const defaultLookups = [];
  const rows = await prepareCustomerExport(
    [
      { CurrencyCode: "USD", CustomerId: "HAS-CONTRACT", HasAutoPay: true },
      { CurrencyCode: "USD", CustomerId: "NEEDS-DEFAULT", HasAutoPay: false },
      { CurrencyCode: "USD", CustomerId: "CONTRACT-ERROR", HasAutoPay: false },
    ],
    {
      getAutoPayContract: async (customerId) => {
        if (customerId === "CONTRACT-ERROR") {
          throw new Error("Contract endpoint unavailable");
        }
        if (customerId === "HAS-CONTRACT") {
          return {
            data: {
              ID: "contract-id",
              PaymentMethod: { Guid: "contract-wallet" },
            },
            status: 200,
          };
        }
        return { data: { ID: "contract-id-without-wallet" }, status: 200 };
      },
      getDefaultPaymentMethod: async (customerId) => {
        defaultLookups.push(customerId);
        return { data: { PaymentMethodGuid: "default-wallet" }, status: 200 };
      },
    },
  );

  assert.equal(rows[0].WalletGuid, "contract-wallet");
  assert.equal(rows[0].WalletSource, "AutoPay Contract");
  assert.equal(rows[1].WalletGuid, "default-wallet");
  assert.equal(rows[1].WalletSource, "Default Payment Method");
  assert.equal(rows[2].WalletGuid, null);
  assert.equal(rows[2].WalletSource, "Lookup Failed");
  assert.deepEqual(defaultLookups, ["NEEDS-DEFAULT"]);
});

test("customer export recognizes a contract WalletEntryGuid", async () => {
  const rows = await prepareCustomerExport(
    [{ CurrencyCode: "USD", CustomerId: "WALLET-ENTRY", HasAutoPay: true }],
    {
      getAutoPayContract: async () => ({
        data: { WalletEntryGuid: "wallet-entry-guid" },
        status: 200,
      }),
      getDefaultPaymentMethod: async () => {
        throw new Error("default wallet should not be requested");
      },
    },
  );

  assert.equal(rows[0].WalletGuid, "wallet-entry-guid");
  assert.equal(rows[0].WalletSource, "AutoPay Contract");
});

test("customer export workbook includes customer data and import-ready assignments", async () => {
  const workbook = createCustomerExportWorkbook([
    {
      ActiveUsers: 2,
      AutoPayStatus: "Not on AutoPay",
      CreditBalance: 5,
      CurrencyCode: "USD",
      CustomerId: "CUST-1",
      Email: "billing@example.com",
      InvoiceBalance: 125.5,
      Name: "Example Customer",
      NextAutoPay: null,
      PastDueBalance: 25.5,
      WalletGuid: "wallet-guid-1",
      WalletSource: "AutoPay Contract",
    },
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);

  const customerData = loaded.getWorksheet("Customer Data");
  assert.equal(customerData.getCell("A2").value, "CUST-1");
  assert.equal(customerData.getCell("K2").value, "wallet-guid-1");
  assert.equal(customerData.getCell("L2").value, "AutoPay Contract");
  assert.equal(customerData.getCell("E2").value, 125.5);

  const assignments = loaded.getWorksheet("Assignments");
  assert.equal(assignments.getCell("A2").value, "CUST-1");
  assert.equal(assignments.getCell("F2").value, "USD");
  assert.equal(assignments.getCell("N2").value, "wallet-guid-1");
});

test("selected customer export keeps missing and failed wallet lookups visible", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-customer-export-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const destination = path.join(directory, "Selected-Customers.xlsx");
  const customers = [
    { CurrencyCode: "USD", CustomerId: "FOUND", HasAutoPay: false },
    { CurrencyCode: "USD", CustomerId: "MISSING", HasAutoPay: false },
    { CurrencyCode: "USD", CustomerId: "FAILED", HasAutoPay: false },
  ];
  const harness = createIPCHarness({
    autopayContracts: {
      FOUND: { data: { PaymentMethod: "contract-wallet" }, status: 200 },
    },
    autopayPaymentMethods: {
      FAILED: { data: null, error: "Wallet endpoint unavailable", status: 503 },
      MISSING: { data: null, status: 200 },
    },
    selectedSaveFilePath: destination,
  });

  const result = await harness.handlers.get(
    CHANNELS.AUTOPAY_EXPORT_CUSTOMERS,
  )(undefined, customers);

  assert.deepEqual(result, {
    failed: 1,
    fileName: "Selected-Customers.xlsx",
    found: 1,
    missing: 1,
    total: 3,
  });
  assert.deepEqual(harness.walletLookupRequests, [
    { currencyCode: "USD", customerId: "MISSING" },
    { currencyCode: "USD", customerId: "FAILED" },
  ]);
  assert.deepEqual(harness.contractLookupRequests, [
    "FOUND",
    "MISSING",
    "FAILED",
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(destination);
  const customerData = workbook.getWorksheet("Customer Data");
  assert.equal(customerData.rowCount, 4);
  assert.equal(customerData.getCell("K2").value, "contract-wallet");
  assert.equal(customerData.getCell("L2").value, "AutoPay Contract");
  assert.ok(
    harness.messages.some(
      (message) =>
        message.channel === CHANNELS.AUTOPAY_EXPORT_PROGRESS &&
        message.value.completed === 3,
    ),
  );
});

test("a thrown wallet lookup does not prevent the Excel file from being written", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-customer-export-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const destination = path.join(directory, "Selected-Customers");
  const excelDestination = `${destination}.xlsx`;
  const harness = createIPCHarness({
    autopayPaymentMethods: {
      FAILED: new Error("Wallet request timed out"),
      FOUND: { data: { PaymentMethodGuid: "wallet-guid" }, status: 200 },
    },
    selectedSaveFilePath: destination,
  });

  const result = await harness.handlers.get(
    CHANNELS.AUTOPAY_EXPORT_CUSTOMERS,
  )(undefined, [
    { CurrencyCode: "USD", CustomerId: "FAILED", HasAutoPay: false },
    { CurrencyCode: "USD", CustomerId: "FOUND", HasAutoPay: false },
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.fileName, "Selected-Customers.xlsx");
  assert.equal(fs.existsSync(excelDestination), true);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelDestination);
  assert.equal(workbook.getWorksheet("Customer Data").rowCount, 3);
});
