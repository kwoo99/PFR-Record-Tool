/**
 * Bulk deletion lifecycle module.
 * Owns bounded parallelism, progress snapshots, pause/resume state, and failed
 * record retries. UI and IPC code should use the returned interface rather than
 * reproduce deletion state calculations.
 */
const DEFAULT_MAX_CONCURRENCY = 5;

function createDeletionManager({
  deleteRecord,
  maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  onProgress = () => {},
  onResult = () => {},
}) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("maxConcurrency must be a positive integer");
  }

  // Private operation state retained between pause, resume, and retry commands.
  let deleteType = "Partial";
  let failedRecords = [];
  let remainingRecords = [];
  let cancelRequested = false;
  let state = createIdleState();

  // Progress model exposed to both IPC handlers and renderer screens.
  function createIdleState() {
    return {
      concurrency: 0,
      failed: 0,
      inFlight: 0,
      operation: "delete",
      processed: 0,
      status: "idle",
      succeeded: 0,
      total: 0,
    };
  }

  function getSnapshot() {
    const remaining = ["running", "cancelling"].includes(state.status)
      ? state.total - state.processed
      : remainingRecords.length;
    return {
      ...state,
      canCancel: state.status === "running",
      canResume: state.status === "paused" && remaining > 0,
      canRetry: state.status === "completed" && failedRecords.length > 0,
      maxConcurrency,
      progress:
        state.total === 0
          ? 0
          : Math.round((state.processed / state.total) * 100),
      remaining,
    };
  }

  function emitProgress() {
    const snapshot = getSnapshot();
    onProgress(snapshot);
    return snapshot;
  }

  // Scheduling policy: larger inputs receive more workers, capped by the caller.
  function chooseConcurrency(recordCount) {
    let desiredConcurrency = 1;
    if (recordCount > 500) {
      desiredConcurrency = 5;
    } else if (recordCount > 200) {
      desiredConcurrency = 4;
    } else if (recordCount > 50) {
      desiredConcurrency = 3;
    } else if (recordCount > 10) {
      desiredConcurrency = 2;
    }

    return Math.min(maxConcurrency, desiredConcurrency, recordCount);
  }

  function splitIntoChunks(records, chunkCount) {
    const chunkSize = Math.ceil(records.length / chunkCount);
    return Array.from({ length: chunkCount }, (_, index) =>
      records.slice(index * chunkSize, (index + 1) * chunkSize),
    ).filter((chunk) => chunk.length > 0);
  }

  // Worker engine: each chunk runs sequentially; chunks run in parallel.
  async function processRecord(record) {
    state.inFlight++;

    let result;
    try {
      const response = await deleteRecord(record.id, deleteType);
      result = {
        id: record.id,
        ok: response.status === 200,
        status: response.status,
      };
    } catch (error) {
      result = {
        error: error.message,
        id: record.id,
        ok: false,
        status: null,
      };
    }

    state.inFlight--;
    state.processed++;
    if (result.ok) {
      state.succeeded++;
    } else {
      state.failed++;
      failedRecords.push(record);
    }

    onResult(result);
    emitProgress();
  }

  async function runRemainingRecords() {
    const records = remainingRecords;
    remainingRecords = [];
    cancelRequested = false;
    state.status = "running";
    state.concurrency = chooseConcurrency(records.length);
    emitProgress();

    const unprocessed = [];
    const chunks = splitIntoChunks(records, state.concurrency);
    await Promise.all(
      chunks.map(async (chunk) => {
        for (let index = 0; index < chunk.length; index++) {
          if (cancelRequested) {
            unprocessed.push(...chunk.slice(index));
            return;
          }
          await processRecord(chunk[index]);
        }
      }),
    );

    remainingRecords = unprocessed.sort(
      (left, right) => left.order - right.order,
    );
    state.status = remainingRecords.length > 0 ? "paused" : "completed";
    state.inFlight = 0;
    return emitProgress();
  }

  // Public lifecycle commands returned at the module interface below.
  function start({ records, deleteType: requestedDeleteType }) {
    if (state.status === "running" || state.status === "cancelling") {
      throw new Error("A deletion is already running");
    }
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("At least one record is required");
    }

    deleteType = requestedDeleteType;
    failedRecords = [];
    remainingRecords = records.map((id, order) => ({ id, order }));
    state = {
      concurrency: 0,
      failed: 0,
      inFlight: 0,
      operation: "delete",
      processed: 0,
      status: "idle",
      succeeded: 0,
      total: records.length,
    };

    return runRemainingRecords();
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
    if (state.status !== "paused" || remainingRecords.length === 0) {
      throw new Error("There is no paused deletion to continue");
    }
    return runRemainingRecords();
  }

  function retryFailed() {
    if (state.status !== "completed" || failedRecords.length === 0) {
      throw new Error("There are no failed records to retry");
    }

    remainingRecords = failedRecords.map((record, order) => ({
      id: record.id,
      order,
    }));
    failedRecords = [];
    state = {
      concurrency: 0,
      failed: 0,
      inFlight: 0,
      operation: "retry",
      processed: 0,
      status: "idle",
      succeeded: 0,
      total: remainingRecords.length,
    };

    return runRemainingRecords();
  }

  return { cancel, getSnapshot, resume, retryFailed, start };
}

module.exports = { createDeletionManager };
