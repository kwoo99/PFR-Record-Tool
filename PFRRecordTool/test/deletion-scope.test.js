/** Verifies that every deletion entry point honors the selected scope. */
const assert = require("node:assert/strict");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("the deletion scope toggle controls every standard delete path", async () => {
  const { deletionStarts, directDeletes, handlers } = createIPCHarness({
    customerIds: ["PORTAL-1", "PORTAL-2"],
  });

  // Replaying the same UI state must not reverse the selected deletion scope.
  await handlers.get(CHANNELS.TOGGLE_DELETE)(undefined, true);
  await handlers.get(CHANNELS.TOGGLE_DELETE)(undefined, true);
  assert.equal(await handlers.get(CHANNELS.GET_DELETE_SCOPE)(), "Full");

  await handlers.get(CHANNELS.FETCH_PORTAL_CUSTOMERS)();
  await handlers.get(CHANNELS.DELETE_ALL_CONFIRM)();

  await handlers.get(CHANNELS.DELETE_DISPLAYED)(undefined, ["FILTERED-1"]);
  await handlers.get(CHANNELS.DELETE_DISPLAYED_CONFIRM)();

  await handlers.get(CHANNELS.BULK_DELETE_RECORD)(undefined, {
    ids: ["PASTED-1", "PASTED-2"],
  });

  await handlers.get(CHANNELS.SET_RECORD)(undefined, {
    targetId: "SINGLE-FULL",
    targetType: "customers",
  });
  await handlers.get(CHANNELS.DELETE_CONFIRM)();

  assert.deepEqual(deletionStarts, [
    {
      records: ["PORTAL-1", "PORTAL-2"],
      deleteType: "Full",
    },
    { records: ["FILTERED-1"], deleteType: "Full" },
    { records: ["PASTED-1", "PASTED-2"], deleteType: "Full" },
  ]);
  assert.deepEqual(directDeletes, [
    { id: "SINGLE-FULL", deleteType: "Full" },
  ]);

  await handlers.get(CHANNELS.TOGGLE_DELETE)(undefined, false);
  assert.equal(await handlers.get(CHANNELS.GET_DELETE_SCOPE)(), "Partial");
  await handlers.get(CHANNELS.BULK_DELETE_RECORD)(undefined, {
    ids: ["CUSTOMER-ONLY"],
  });

  await handlers.get(CHANNELS.SET_RECORD)(undefined, {
    targetId: "SINGLE-PARTIAL",
    targetType: "customers",
  });
  await handlers.get(CHANNELS.DELETE_CONFIRM)();

  await handlers.get(CHANNELS.SET_RECORD)(undefined, {
    targetId: "EXPLICIT-ACCOUNT",
    targetType: "customers",
  });
  await handlers.get(CHANNELS.DELETE_ACCOUNT_CONFIRM)();

  assert.deepEqual(deletionStarts.at(-1), {
    records: ["CUSTOMER-ONLY"],
    deleteType: "Partial",
  });
  assert.deepEqual(directDeletes.slice(-2), [
    { id: "SINGLE-PARTIAL", deleteType: "Partial" },
    { id: "EXPLICIT-ACCOUNT", deleteType: "Full" },
  ]);
});
