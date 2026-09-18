/** Verifies safe AutoPay apply/remove behavior before a mutation is sent. */
const assert = require("node:assert/strict");
const test = require("node:test");

const { createAutoPayService } = require("../src/main/autopay/service.js");

test("bulk apply skips customers that already have AutoPay", async () => {
  let creates = 0;
  const service = createAutoPayService({
    createAutoPayContract: async () => {
      creates++;
    },
    getAutoPayContract: async () => ({
      data: { CustomerId: "CUST-1" },
      error: null,
      status: 200,
    }),
  });

  const result = await service.apply(
    { CurrencyCode: "USD", CustomerId: "CUST-1" },
    {},
  );

  assert.equal(result.outcome, "skipped");
  assert.equal(creates, 0);
});

test("bulk apply uses the customer's default payment method", async () => {
  const requests = [];
  const service = createAutoPayService({
    createAutoPayContract: async (customerId, contract) => {
      requests.push({ contract, customerId });
      return { data: true, error: null, status: 200 };
    },
    getAutoPayContract: async () => ({ data: null, error: null, status: 404 }),
    getDefaultPaymentMethod: async () => ({
      data: { PaymentMethodGuid: "wallet-guid" },
      error: null,
      status: 200,
    }),
  });

  const result = await service.apply(
    { CurrencyCode: "USD", CustomerId: "CUST-1" },
    {
      configuration: {
        AmountOption: "Outstanding",
        Frequency: "Monthly",
      },
      nextPaymentDate: "2026-10-15T12:00:00.000Z",
    },
  );

  assert.equal(result.outcome, "succeeded");
  assert.equal(requests[0].contract.PaymentMethod, "wallet-guid");
});

test("bulk remove skips customers without a contract", async () => {
  let deletes = 0;
  const service = createAutoPayService({
    deleteAutoPayContract: async () => {
      deletes++;
    },
    getAutoPayContract: async () => ({ data: null, error: null, status: 404 }),
  });

  const result = await service.remove({ CustomerId: "CUST-1" });
  assert.equal(result.outcome, "skipped");
  assert.equal(deletes, 0);
});

test("bulk update patches only explicit fields and preserves the current wallet", async () => {
  const updates = [];
  const service = createAutoPayService({
    getAutoPayContract: async () => ({
      data: {
        AmountOption: "Outstanding",
        PaymentMethod: "current-wallet-guid",
      },
      error: null,
      status: 200,
    }),
    getDefaultPaymentMethod: async () => {
      throw new Error("an existing-contract update must not request a default wallet");
    },
    updateAutoPayContract: async (customerId, contract) => {
      updates.push({ contract, customerId });
      return { data: true, error: null, status: 200 };
    },
  });

  const result = await service.update(
    { CustomerId: "CUST-1" },
    {
      configuration: { AmountOption: "", PaymentMethod: "" },
      nextPaymentDate: "2026-11-20T00:00:00.000Z",
    },
  );

  assert.equal(result.outcome, "succeeded");
  assert.deepEqual(updates, [
    {
      contract: {
        CustomerId: "CUST-1",
        NextPaymentDate: "2026-11-20T00:00:00.000Z",
      },
      customerId: "CUST-1",
    },
  ]);
});

test("bulk update skips a selected customer without AutoPay", async () => {
  let updates = 0;
  const service = createAutoPayService({
    getAutoPayContract: async () => ({ data: null, error: null, status: 404 }),
    updateAutoPayContract: async () => {
      updates++;
    },
  });

  const result = await service.update(
    { CustomerId: "NO-CONTRACT" },
    { nextPaymentDate: "2026-11-20T00:00:00.000Z" },
  );

  assert.equal(result.outcome, "skipped");
  assert.match(result.message, /No AutoPay contract/);
  assert.equal(updates, 0);
});

test("individual updates recheck that the contract still exists", async () => {
  let updates = 0;
  const service = createAutoPayService({
    getAutoPayContract: async () => ({ data: null, error: null, status: 404 }),
    updateAutoPayContract: async () => {
      updates++;
      return { data: true, error: null, status: 200 };
    },
  });

  const result = await service.saveContract({
    contract: { AmountOption: "Outstanding" },
    customerId: "CUST-1",
    mode: "update",
  });

  assert.match(result.error, /no longer exists/i);
  assert.equal(updates, 0);
});
