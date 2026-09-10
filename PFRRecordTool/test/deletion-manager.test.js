/** Verifies deletion concurrency, progress, pause/resume, and retry behavior. */
const assert = require("node:assert/strict");
const test = require("node:test");

const { createDeletionManager } = require("../src/main/deletion/manager.js");

function waitFor(predicate) {
  return new Promise((resolve) => {
    const check = () => {
      if (predicate()) {
        resolve();
      } else {
        setImmediate(check);
      }
    };
    check();
  });
}

test("uses adaptive concurrency without exceeding the configured maximum", async () => {
  let active = 0;
  let peakActive = 0;
  const deleteRecord = async () => {
    active++;
    peakActive = Math.max(peakActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return { status: 200 };
  };
  const manager = createDeletionManager({
    deleteRecord,
    maxConcurrency: 4,
  });

  const result = await manager.start({
    records: Array.from({ length: 600 }, (_, index) => `CUST-${index}`),
    deleteType: "Partial",
  });

  assert.equal(peakActive, 4);
  assert.equal(result.status, "completed");
  assert.equal(result.succeeded, 600);
  assert.equal(result.failed, 0);
  assert.equal(result.remaining, 0);
});

test("scales worker count with the size of the deletion list", async () => {
  const manager = createDeletionManager({
    deleteRecord: async () => ({ status: 200 }),
  });

  for (const [recordCount, expectedConcurrency] of [
    [5, 1],
    [25, 2],
    [100, 3],
    [300, 4],
    [600, 5],
  ]) {
    const result = await manager.start({
      records: Array.from({ length: recordCount }, (_, index) => `${index}`),
      deleteType: "Partial",
    });
    assert.equal(result.concurrency, expectedConcurrency);
  }
});

test("forwards the selected scope to every bulk deletion request", async () => {
  const requests = [];
  const manager = createDeletionManager({
    deleteRecord: async (recordId, deleteType) => {
      requests.push({ recordId, deleteType });
      return { status: 200 };
    },
  });

  await manager.start({ records: ["A", "B"], deleteType: "Full" });
  await manager.start({ records: ["C"], deleteType: "Partial" });

  assert.deepEqual(requests, [
    { recordId: "A", deleteType: "Full" },
    { recordId: "B", deleteType: "Full" },
    { recordId: "C", deleteType: "Partial" },
  ]);
});

test("pauses before new records start and continues the remaining records", async () => {
  const pending = [];
  const attempted = [];
  let useDeferredResponse = true;
  const deleteRecord = (recordId) => {
    attempted.push(recordId);
    if (!useDeferredResponse) {
      return Promise.resolve({ status: 200 });
    }
    return new Promise((resolve) =>
      pending.push(() => resolve({ status: 200 })),
    );
  };
  const manager = createDeletionManager({
    deleteRecord,
    maxConcurrency: 2,
  });

  const running = manager.start({
    records: ["A", "B", "C", "D", "E"],
    deleteType: "Partial",
  });
  await waitFor(() => pending.length === 1);
  const cancelling = manager.cancel();
  assert.equal(cancelling.status, "cancelling");
  assert.equal(cancelling.remaining, 5);
  pending.splice(0).forEach((resolve) => resolve());

  const paused = await running;
  assert.equal(paused.status, "paused");
  assert.equal(paused.processed, 1);
  assert.equal(paused.remaining, 4);

  useDeferredResponse = false;
  const completed = await manager.resume();

  assert.equal(completed.status, "completed");
  assert.equal(completed.succeeded, 5);
  assert.equal(completed.remaining, 0);
  assert.deepEqual(attempted.sort(), ["A", "B", "C", "D", "E"]);
});

test("retries only records that failed during the completed cycle", async () => {
  const attempts = new Map();
  const deleteRecord = async (recordId) => {
    attempts.set(recordId, (attempts.get(recordId) ?? 0) + 1);
    return {
      status: recordId === "B" && attempts.get(recordId) === 1 ? 500 : 200,
    };
  };
  const manager = createDeletionManager({ deleteRecord });

  const firstPass = await manager.start({
    records: ["A", "B", "C"],
    deleteType: "Partial",
  });
  assert.equal(firstPass.failed, 1);
  assert.equal(firstPass.canRetry, true);

  const retry = await manager.retryFailed();
  assert.equal(retry.status, "completed");
  assert.equal(retry.total, 1);
  assert.equal(retry.succeeded, 1);
  assert.equal(retry.failed, 0);
  assert.deepEqual(Object.fromEntries(attempts), { A: 1, B: 2, C: 1 });
});
