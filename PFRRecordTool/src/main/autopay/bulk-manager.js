/**
 * Bounded AutoPay bulk-operation lifecycle.
 * Retains unfinished and temporarily failed customers in memory so a user can
 * pause, continue, or retry without rebuilding the selection during the session.
 */
const DEFAULT_MAX_CONCURRENCY = 3;

function createAutoPayBulkManager({
  execute,
  maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  onProgress = () => {},
  onResult = () => {},
}) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("maxConcurrency must be a positive integer");
  }

  let cancelRequested = false;
  let failedItems = [];
  let operation = null;
  let options = null;
  let remainingItems = [];
  let resultHistory = [];
  let retryMode = false;
  let retryProcessed = 0;
  let retryTotal = 0;
  let state = idleState();

  function idleState() {
    return {
      concurrency: 0,
      failed: 0,
      inFlight: 0,
      operation: null,
      processed: 0,
      skipped: 0,
      status: "idle",
      succeeded: 0,
      total: 0,
    };
  }

  function getSnapshot() {
    const remaining = ["running", "cancelling"].includes(state.status)
      ? retryMode
        ? retryTotal - retryProcessed
        : state.total - state.processed
      : remainingItems.length;
    const retryable = failedItems.filter((item) => item.retryable).length;
    return {
      ...state,
      canCancel: state.status === "running",
      canResume: state.status === "paused" && remaining > 0,
      canRetry: state.status === "completed" && retryable > 0,
      maxConcurrency,
      progress:
        retryMode
          ? retryTotal === 0
            ? 0
            : Math.round((retryProcessed / retryTotal) * 100)
          : state.total === 0
          ? 0
          : Math.round((state.processed / state.total) * 100),
      remaining,
      results: [...resultHistory],
      retrying: retryMode,
      retryable,
    };
  }

  function emitProgress() {
    const snapshot = getSnapshot();
    onProgress(snapshot);
    return snapshot;
  }

  function chooseConcurrency(count) {
    if (count > 50) return Math.min(3, maxConcurrency, count);
    if (count > 10) return Math.min(2, maxConcurrency, count);
    return Math.min(1, maxConcurrency, count);
  }

  async function processItem(item) {
    state.inFlight++;
    emitProgress();
    let result;
    try {
      result = await execute({
        customer: item.customer,
        operation,
        options: item.options ?? options,
      });
    } catch (error) {
      result = {
        message: error.message,
        outcome: "failed",
        retryable: true,
        status: null,
      };
    }

    state.inFlight--;
    if (retryMode) retryProcessed++;
    else state.processed++;
    if (result.outcome === "succeeded") state.succeeded++;
    if (result.outcome === "skipped") state.skipped++;
    if (result.outcome === "failed") {
      state.failed++;
      failedItems.push({ ...item, retryable: Boolean(result.retryable) });
    }
    const outcome = { customerId: item.customer.CustomerId, ...result };
    resultHistory.push(outcome);
    onResult(outcome);
    emitProgress();
  }

  async function runRemaining() {
    const queue = remainingItems;
    remainingItems = [];
    cancelRequested = false;
    state.status = "running";
    state.concurrency = chooseConcurrency(queue.length);
    if (retryMode) {
      retryProcessed = 0;
      retryTotal = queue.length;
    }
    emitProgress();

    let nextIndex = 0;
    async function worker() {
      while (nextIndex < queue.length) {
        if (cancelRequested) return;
        const item = queue[nextIndex++];
        await processItem(item);
      }
    }

    await Promise.all(
      Array.from({ length: state.concurrency }, () => worker()),
    );
    remainingItems = queue.slice(nextIndex);
    state.status = remainingItems.length ? "paused" : "completed";
    state.inFlight = 0;
    if (!remainingItems.length) retryMode = false;
    return emitProgress();
  }

  function start({ customers, operation: requestedOperation, options: nextOptions }) {
    if (["running", "cancelling"].includes(state.status)) {
      throw new Error("An AutoPay operation is already running");
    }
    if (!Array.isArray(customers) || customers.length === 0) {
      throw new Error("Select at least one customer");
    }
    if (!["apply", "remove", "update"].includes(requestedOperation)) {
      throw new Error("AutoPay operation must be apply, update, or remove");
    }

    operation = requestedOperation;
    options = nextOptions ?? {};
    failedItems = [];
    resultHistory = [];
    retryMode = false;
    retryProcessed = 0;
    retryTotal = 0;
    remainingItems = customers.map((customer, order) => ({ customer, order }));
    state = {
      concurrency: 0,
      failed: 0,
      inFlight: 0,
      operation,
      processed: 0,
      skipped: 0,
      status: "idle",
      succeeded: 0,
      total: customers.length,
    };
    return runRemaining();
  }

  function cancel() {
    if (state.status === "running") {
      cancelRequested = true;
      state.status = "cancelling";
      emitProgress();
    }
    return getSnapshot();
  }

  function resume() {
    if (state.status !== "paused" || !remainingItems.length) {
      throw new Error("There is no paused AutoPay operation to continue");
    }
    return runRemaining();
  }

  function retryFailed() {
    if (state.status !== "completed") {
      throw new Error("Wait for the AutoPay operation to finish before retrying");
    }
    const retryableItems = failedItems.filter((item) => item.retryable);
    if (!retryableItems.length) {
      throw new Error("There are no temporary AutoPay failures to retry");
    }

    remainingItems = retryableItems.map((item, order) => ({ ...item, order }));
    failedItems = failedItems.filter((item) => !item.retryable);
    state.concurrency = 0;
    state.failed = failedItems.length;
    state.inFlight = 0;
    state.status = "idle";
    retryMode = true;
    return runRemaining();
  }

  function clearResults() {
    resultHistory = [];
    return true;
  }

  return { cancel, clearResults, getSnapshot, resume, retryFailed, start };
}

module.exports = { createAutoPayBulkManager };
