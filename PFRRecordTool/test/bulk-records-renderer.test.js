/** Verifies the pasted-ID workspace opens only the first record. */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");

function fakeElement(value = "") {
  return {
    listeners: {},
    textContent: "",
    value,
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    append() {},
  };
}

test("View/change activates the text source and opens only its first ID", async () => {
  const elements = {
    bulkRecordInput: fakeElement("FIRST; SECOND; THIRD"),
    bulkRecordType: fakeElement("customers"),
    bulkFetchButton: fakeElement(),
    bulkDeleteButton: fakeElement(),
    bulkChangeButton: fakeElement(),
    bulkStatus: fakeElement(),
    feedBox: fakeElement(),
  };
  const invocations = [];
  const originalDocument = global.document;
  const originalWindow = global.window;
  global.document = {
    createElement: () => fakeElement(),
    getElementById: (id) => elements[id],
  };
  global.window = {
    api: {
      comm: {
        CHANNELS,
        invoke: async (channel, value) => {
          invocations.push({ channel, value });
          return channel === CHANNELS.SET_RECORD ? { status: 200 } : undefined;
        },
      },
    },
    feedWorkspace: { appendRecordResult: () => {} },
  };

  try {
    const rendererPath = path.join(
      __dirname,
      "../src/renderer/main/bulk-records.js",
    );
    delete require.cache[rendererPath];
    require(rendererPath);
    await elements.bulkChangeButton.listeners.click();
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }

  assert.deepEqual(invocations, [
    {
      channel: CHANNELS.ACTIVATE_TEXT_LIST,
      value: { count: 3 },
    },
    {
      channel: CHANNELS.SET_RECORD,
      value: { targetId: "FIRST", targetType: "customers" },
    },
    {
      channel: CHANNELS.CHANGE_RECORD,
      value: { targetId: "FIRST", targetType: "customers" },
    },
  ]);
  assert.match(elements.bulkStatus.textContent, /FIRST/);
  assert.match(elements.bulkStatus.textContent, /first ID/i);
});
