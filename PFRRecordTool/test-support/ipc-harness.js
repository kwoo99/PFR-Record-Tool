/**
 * Builds an isolated IPC test harness without starting Electron or contacting
 * PayFabric. Tests can invoke registered channels exactly as renderers do.
 */
const Module = require("node:module");
const path = require("node:path");

function createIPCHarness({ customerIds = [], selectedFilePath } = {}) {
  const handlers = new Map();
  const messages = [];
  const deletionStarts = [];
  const directDeletes = [];
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
    on: (channel, handler) => handlers.set(channel, handler),
  };
  const projectRoot = path.join(__dirname, "..");
  const dependencyStubs = new Map([
    [
      path.join(projectRoot, "src/main/payfabric/client.js"),
      {
        configure: () => {},
        deleteRecord: async (id, deleteType) => {
          directDeletes.push({ id, deleteType });
          return { status: 200 };
        },
        getRecord: async () => ({ status: 200 }),
        listCustomerIds: async () => customerIds,
        updateRecord: async () => ({ status: 200 }),
      },
    ],
    [
      path.join(projectRoot, "src/main/deletion/manager.js"),
      {
        createDeletionManager: () => ({
          cancel: () => {},
          getSnapshot: () => ({ status: "idle" }),
          resume: () => {},
          retryFailed: () => {},
          start: (options) => {
            deletionStarts.push({
              records: [...options.records],
              deleteType: options.deleteType,
            });
            return options;
          },
        }),
      },
    ],
    [
      path.join(projectRoot, "src/main/windows/manager.js"),
      {
        closeConfirmation: () => {},
        closeRecordEditor: () => {},
        openConfirmation: () => {},
        openRecordEditor: () => {},
      },
    ],
  ]);
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return {
        dialog: {
          showOpenDialog: async () =>
            selectedFilePath
              ? { canceled: false, filePaths: [selectedFilePath] }
              : { canceled: true, filePaths: [] },
        },
        ipcMain,
      };
    }

    const resolved = Module._resolveFilename(request, parent, isMain);
    if (dependencyStubs.has(resolved)) {
      return dependencyStubs.get(resolved);
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let setupIPCHandlers;
  try {
    const handlerPath = path.join(
      projectRoot,
      "src/main/ipc/register-handlers.js",
    );
    delete require.cache[handlerPath];
    ({ setupIPCHandlers } = require(handlerPath));
  } finally {
    Module._load = originalLoad;
  }

  setupIPCHandlers({
    webContents: {
      send: (channel, value) => messages.push({ channel, value }),
    },
  });

  return { deletionStarts, directDeletes, handlers, messages };
}

module.exports = { createIPCHarness };
