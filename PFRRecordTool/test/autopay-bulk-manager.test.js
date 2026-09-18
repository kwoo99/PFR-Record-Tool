/** Verifies bounded AutoPay progress, continuation, and temporary retries. */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAutoPayBulkManager,
} = require("../src/main/autopay/bulk-manager.js");

test("caps large AutoPay operations at three workers", async () => {
  let active = 0;
  let peak = 0;
  const manager = createAutoPayBulkManager({
    execute: async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      return { outcome: "succeeded" };
    },
  });

  const result = await manager.start({
    customers: Array.from({ length: 60 }, (_, index) => ({
      CustomerId: `CUST-${index}`,
    })),
    operation: "remove",
  });

  assert.equal(peak, 3);
  assert.equal(result.succeeded, 60);
  assert.equal(result.remaining, 0);
});

test("retries temporary failures but not validation failures", async () => {
  const attempts = new Map();
  const manager = createAutoPayBulkManager({
    execute: async ({ customer }) => {
      const attempt = (attempts.get(customer.CustomerId) ?? 0) + 1;
      attempts.set(customer.CustomerId, attempt);
      if (customer.CustomerId === "TEMP" && attempt === 1) {
        return { outcome: "failed", retryable: true, status: 503 };
      }
      if (customer.CustomerId === "INVALID") {
        return { outcome: "failed", retryable: false, status: 400 };
      }
      return { outcome: "succeeded" };
    },
  });

  const first = await manager.start({
    customers: [{ CustomerId: "TEMP" }, { CustomerId: "INVALID" }],
    operation: "apply",
  });
  assert.equal(first.failed, 2);
  assert.equal(first.retryable, 1);
  assert.equal(first.canRetry, true);

  const retried = await manager.retryFailed();
  assert.equal(retried.total, 2);
  assert.equal(retried.processed, 2);
  assert.equal(retried.succeeded, 1);
  assert.equal(retried.failed, 1);
  assert.equal(retried.results.length, 3);
  assert.deepEqual(Object.fromEntries(attempts), { INVALID: 1, TEMP: 2 });
});

test("retains outcome history and clears it only when requested", async () => {
  const manager = createAutoPayBulkManager({
    execute: async ({ customer }) => ({
      message: "changed",
      outcome: "succeeded",
      status: 200,
      customerId: customer.CustomerId,
    }),
  });

  const completed = await manager.start({
    customers: [{ CustomerId: "CUST-1" }, { CustomerId: "CUST-2" }],
    operation: "apply",
  });
  assert.deepEqual(
    completed.results.map((result) => result.customerId),
    ["CUST-1", "CUST-2"],
  );
  assert.equal(manager.clearResults(), true);
  assert.deepEqual(manager.getSnapshot().results, []);
});

test("accepts update as a guarded bulk operation", async () => {
  const operations = [];
  const manager = createAutoPayBulkManager({
    execute: async ({ operation }) => {
      operations.push(operation);
      return { outcome: "succeeded" };
    },
  });

  const completed = await manager.start({
    customers: [{ CustomerId: "CUST-1" }],
    operation: "update",
    options: { nextPaymentDate: "2026-11-20T00:00:00.000Z" },
  });

  assert.deepEqual(operations, ["update"]);
  assert.equal(completed.succeeded, 1);
});
