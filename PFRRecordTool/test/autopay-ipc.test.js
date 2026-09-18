/** Verifies AutoPay list filtering and connection context at the IPC boundary. */
const assert = require("node:assert/strict");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("AutoPay customer status filters use the portal report schedule", async () => {
  const customers = [
    { CustomerId: "ON-1", NextAutoPay: "2026-10-15T12:00:00.000Z" },
    { CustomerId: "OFF-1", NextAutoPay: null },
    { CustomerId: "OFF-SENTINEL", NextAutoPay: "1900-01-01T00:00:00.000Z" },
  ];
  const { handlers } = createIPCHarness({ autopayCustomers: customers });

  const on = await handlers.get(CHANNELS.AUTOPAY_LIST_CUSTOMERS)(undefined, {
    autoPayStatus: "on",
  });
  const off = await handlers.get(CHANNELS.AUTOPAY_LIST_CUSTOMERS)(undefined, {
    autoPayStatus: "off",
  });

  assert.deepEqual(
    on.customers.map((customer) => customer.CustomerId),
    ["ON-1"],
  );
  assert.deepEqual(
    off.customers.map((customer) => customer.CustomerId),
    ["OFF-1", "OFF-SENTINEL"],
  );
  assert.equal(off.customers[1].HasAutoPay, false);
  assert.equal(off.customers[1].NextAutoPay, null);
});

test("AutoPay customer discovery stays within the portal report page limit", async () => {
  const { autopayListRequests, handlers } = createIPCHarness();

  await handlers.get(CHANNELS.AUTOPAY_LIST_CUSTOMERS)(undefined, {
    autoPayStatus: "off",
  });

  assert.equal(autopayListRequests[0].pageSize, undefined);
});

test("AutoPay page receives environment details without receiving credentials", async () => {
  const { handlers } = createIPCHarness({
    portalTimezone: {
      displayName: "Pacific Time",
      name: "America/Los_Angeles",
    },
  });
  await handlers.get(CHANNELS.SET_PORTAL)(undefined, "test-portal");
  await handlers.get(CHANNELS.SET_KEY)(undefined, "secret-key");
  await handlers.get(CHANNELS.SET_PASS)(undefined, "secret-pass");

  const status = await handlers.get(CHANNELS.GET_CONNECTION_STATUS)();

  assert.deepEqual(status, {
    configured: true,
    environment: "Sandbox",
    portalName: "test-portal",
    timezone: {
      displayName: "Pacific Time",
      name: "America/Los_Angeles",
    },
  });
  assert.equal(JSON.stringify(status).includes("secret"), false);
});

test("timezone lookup failure does not block the AutoPay connection", async () => {
  const { handlers } = createIPCHarness({
    portalTimezoneError: new Error("Forbidden"),
  });
  await handlers.get(CHANNELS.SET_PORTAL)(undefined, "test-portal");
  await handlers.get(CHANNELS.SET_KEY)(undefined, "secret-key");
  await handlers.get(CHANNELS.SET_PASS)(undefined, "secret-pass");

  const status = await handlers.get(CHANNELS.GET_CONNECTION_STATUS)();

  assert.equal(status.configured, true);
  assert.equal(status.timezone, null);
});

test("individual AutoPay removal verifies the contract before deleting", async () => {
  const { autopayDeletes, contractLookupRequests, handlers } = createIPCHarness({
    autopayContracts: {
      "CUST-1": {
        data: { CustomerId: "CUST-1" },
        error: null,
        status: 200,
      },
    },
  });

  const result = await handlers.get(CHANNELS.AUTOPAY_DELETE_CONTRACT)(
    undefined,
    "CUST-1",
  );

  assert.deepEqual(contractLookupRequests, ["CUST-1"]);
  assert.deepEqual(autopayDeletes, ["CUST-1"]);
  assert.equal(result.error, null);
});

test("bulk update changes only selected customers with existing AutoPay", async () => {
  const { autopayUpdates, handlers } = createIPCHarness({
    autopayContracts: {
      ACTIVE: {
        data: { PaymentMethod: "current-wallet-guid" },
        error: null,
        status: 200,
      },
    },
  });

  const result = await handlers.get(CHANNELS.AUTOPAY_START_BULK)(undefined, {
    customers: [
      { CustomerId: "ACTIVE", HasAutoPay: true },
      { CustomerId: "INACTIVE", HasAutoPay: false },
    ],
    operation: "update",
    options: { nextPaymentDate: "2026-11-20T00:00:00.000Z" },
  });

  assert.equal(result.succeeded, 1);
  assert.equal(result.skipped, 1);
  assert.deepEqual(autopayUpdates, [
    {
      contract: {
        CustomerId: "ACTIVE",
        NextPaymentDate: "2026-11-20T00:00:00.000Z",
      },
      customerId: "ACTIVE",
    },
  ]);
});
