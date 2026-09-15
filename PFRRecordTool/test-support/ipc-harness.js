/**
 * Builds an isolated IPC test harness without starting Electron or contacting
 * PayFabric. Tests can invoke registered channels exactly as renderers do.
 */
const Module = require("node:module");
const path = require("node:path");

function createIPCHarness({
  autopayContracts = {},
  autopayCustomers = [],
  autopayDeleteResult = { data: true, error: null, status: 200 },
  autopayPaymentMethods = {},
  customerIds = [],
  deleteRecordResult = { status: 200, statusText: "OK" },
  portalTimezone = null,
  portalTimezoneError = null,
  selectedFilePath,
  selectedSaveFilePath,
} = {}) {
  const handlers = new Map();
  const messages = [];
  const autopayListRequests = [];
  const deletionStarts = [];
  const directDeletes = [];
  const autopayDeletes = [];
  const contractLookupRequests = [];
  const walletLookupRequests = [];
  let helpOpenCount = 0;
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
          return deleteRecordResult;
        },
        getRecord: async () => ({ status: 200 }),
        getAutoPayContract: async (customerId) => {
          contractLookupRequests.push(customerId);
          return Object.hasOwn(autopayContracts, customerId)
            ? autopayContracts[customerId]
            : { data: null, status: 404 };
        },
        getDefaultPaymentMethod: async (customerId, currencyCode) => {
          walletLookupRequests.push({ currencyCode, customerId });
          return Object.hasOwn(autopayPaymentMethods, customerId)
            ? autopayPaymentMethods[customerId]
            : {
                data: { PaymentMethodGuid: "wallet-guid" },
                status: 200,
              };
        },
        getPortalTimezone: async () => {
          if (portalTimezoneError) throw portalTimezoneError;
          return portalTimezone;
        },
        createAutoPayContract: async () => ({ data: true, status: 200 }),
        updateAutoPayContract: async () => ({ data: true, status: 200 }),
        deleteAutoPayContract: async (customerId) => {
          autopayDeletes.push(customerId);
          return autopayDeleteResult;
        },
        listAutoPayTemplates: async () => ({ data: [], status: 200 }),
        listCustomers: async (request) => {
          autopayListRequests.push(request);
          return autopayCustomers;
        },
        listCustomerIds: async () => customerIds,
        saveAutoPayTemplate: async () => ({ data: true, status: 200 }),
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
        openHelpWindow: () => {
          helpOpenCount++;
        },
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
          showSaveDialog: async () =>
            selectedSaveFilePath
              ? { canceled: false, filePath: selectedSaveFilePath }
              : { canceled: true },
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
    const autoPayHandlerPath = path.join(
      projectRoot,
      "src/main/ipc/register-autopay-handlers.js",
    );
    const handlerPath = path.join(
      projectRoot,
      "src/main/ipc/register-handlers.js",
    );
    delete require.cache[autoPayHandlerPath];
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

  return {
    autopayDeletes,
    autopayListRequests,
    contractLookupRequests,
    deletionStarts,
    directDeletes,
    handlers,
    helpOpenCount: () => helpOpenCount,
    messages,
    walletLookupRequests,
  };
}

module.exports = { createIPCHarness };
