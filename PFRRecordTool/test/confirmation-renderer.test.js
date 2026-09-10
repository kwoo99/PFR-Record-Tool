/** Verifies destructive confirmation copy reflects the selected delete scope. */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const CHANNELS = require("../src/shared/channels.js");

function element() {
  return {
    listeners: {},
    textContent: "",
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
}

async function renderConfirmation(target, deleteType) {
  const elements = {
    "cancelButton-label": element(),
    "confirmation-description": element(),
    "confirmButton-label": element(),
    "deleteConfirm-label": element(),
  };
  const originalDocument = global.document;
  const originalWindow = global.window;
  global.document = {
    body: {
      dataset: {
        confirmChannel: "DELETE_ALL_CONFIRM",
        deleteTarget: target,
      },
    },
    getElementById: (id) => elements[id],
    title: "",
  };
  global.window = {
    api: {
      comm: {
        CHANNELS,
        invoke: async (channel) =>
          channel === CHANNELS.GET_DELETE_SCOPE ? deleteType : undefined,
      },
    },
  };

  try {
    const rendererPath = path.join(
      __dirname,
      "../src/renderer/confirmations/index.js",
    );
    delete require.cache[rendererPath];
    require(rendererPath);
    await new Promise((resolve) => setImmediate(resolve));
    return {
      button: elements["confirmButton-label"].textContent,
      description: elements["confirmation-description"].textContent,
      title: elements["deleteConfirm-label"].textContent,
    };
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
}

test("loaded-customer confirmation distinguishes Full from Partial", async () => {
  const full = await renderConfirmation("loaded", "Full");
  assert.deepEqual(full, {
    button: "Delete full accounts",
    description:
      "All account data for every loaded customer will be permanently deleted.",
    title: "Delete full accounts for all loaded customers?",
  });

  const partial = await renderConfirmation("loaded", "Partial");
  assert.deepEqual(partial, {
    button: "Delete customers",
    description:
      "Only the loaded customer records will be deleted. Full account deletion is not selected.",
    title: "Delete all loaded customer records?",
  });
});
