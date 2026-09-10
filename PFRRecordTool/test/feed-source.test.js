/** Verifies source changes reset stale feed and loaded-list state. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");
const { createIPCHarness } = require("../test-support/ipc-harness.js");

test("loading a CSV replaces the feed and identifies the selected file", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pfr-source-"));
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  const csvPath = path.join(directory, "customers.csv");
  fs.writeFileSync(csvPath, "CustomerId\nCSV-1\nCSV-2\n");
  const { handlers, messages } = createIPCHarness({
    selectedFilePath: csvPath,
  });

  const result = await handlers.get(CHANNELS.OPEN_FILE_DIALOG)();

  assert.equal(result, csvPath);
  assert.deepEqual(messages, [
    { channel: CHANNELS.FEED_BOX_CLEAR, value: undefined },
    {
      channel: CHANNELS.FEED_SOURCE,
      value: {
        detail: "customers.csv",
        label: "CSV",
        selectionLabel: "customers.csv",
      },
    },
    {
      channel: CHANNELS.FEED_RECORDS_REPLACE,
      value: ["CSV-1", "CSV-2"],
    },
    { channel: CHANNELS.SELECTED_FILE_COUNT, value: 2 },
  ]);
});

test("activating a pasted text list replaces the previous feed source", async () => {
  const { handlers, messages } = createIPCHarness({
    customerIds: ["PORTAL-1"],
  });

  await handlers.get(CHANNELS.FETCH_PORTAL_CUSTOMERS)();
  messages.length = 0;

  const result = await handlers.get(CHANNELS.ACTIVATE_TEXT_LIST)(undefined, {
    count: 3,
  });

  assert.deepEqual(result, { count: 3 });
  assert.deepEqual(messages, [
    { channel: CHANNELS.FEED_BOX_CLEAR, value: undefined },
    {
      channel: CHANNELS.FEED_SOURCE,
      value: {
        detail: "3 pasted record IDs",
        label: "Text list",
        selectionLabel: "Pasted text list",
      },
    },
    {
      channel: CHANNELS.SELECTED_FILE_COUNT,
      value: { count: 0, displayText: "3 IDs in text list" },
    },
  ]);
});
