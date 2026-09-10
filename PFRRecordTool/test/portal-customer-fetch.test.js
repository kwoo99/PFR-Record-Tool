/** Verifies that portal customer discovery populates the shared bulk workspace. */
const assert = require("node:assert/strict");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("fetching all portal customers populates the feed and loaded count", async () => {
  const { handlers, messages } = createIPCHarness({
    customerIds: ["CUST-1", "CUST-2"],
  });

  const result = await handlers.get(
    CHANNELS.FETCH_PORTAL_CUSTOMERS,
  )();

  assert.deepEqual(messages, [
    { channel: CHANNELS.FEED_BOX_CLEAR, value: undefined },
    {
      channel: CHANNELS.FEED_SOURCE,
      value: {
        detail: "All customers in the connected portal",
        label: "Portal",
        selectionLabel: "Portal customer list",
      },
    },
    {
      channel: CHANNELS.FEED_RECORDS_REPLACE,
      value: ["CUST-1", "CUST-2"],
    },
    { channel: CHANNELS.SELECTED_FILE_COUNT, value: 2 },
  ]);
  assert.deepEqual(result, { count: 2 });
});
