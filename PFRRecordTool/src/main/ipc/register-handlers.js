/**
 * Main-process workflow coordinator.
 * Owns renderer IPC handlers and short-lived application state, then delegates
 * network, CSV, deletion, and window behavior to their dedicated modules.
 */
const { dialog, ipcMain } = require("electron");
const path = require("node:path");

const { loadData } = require("../csv/records.js");
const { createDeletionManager } = require("../deletion/manager.js");
const {
  configure,
  deleteRecord,
  getRecord,
  listCustomerIds,
  updateRecord,
} = require("../payfabric/client.js");
const {
  closeConfirmation,
  closeRecordEditor,
  openConfirmation,
  openRecordEditor,
} = require("../windows/manager.js");
const CHANNELS = require("../../shared/channels.js");

// Session-only state shared by related screens; nothing here is persisted.
const state = {
  deleteType: "Partial",
  displayedRecords: [],
  integrationKey: "",
  integrationPass: "",
  isTest: true,
  portalName: "",
  recordList: [],
  submittedRecord: "",
  submittedRecordBody: undefined,
  submittedRecordType: "",
  submittedResponse: null,
};

function configureClient() {
  configure({
    sandbox: state.isTest,
    portalName: state.portalName,
    integrationKey: state.integrationKey,
    integrationPass: state.integrationPass,
  });
}

function send(mainWindow, channel, value) {
  mainWindow.webContents.send(channel, value);
}

// Portal credentials and Sandbox/Production selection.
function registerConfigurationHandlers() {
  ipcMain.handle(CHANNELS.SET_PORTAL, (_event, value) => {
    state.portalName = value;
    console.log("Portal name set to:", state.portalName);
    configureClient();
  });

  ipcMain.handle(CHANNELS.SET_KEY, (_event, value) => {
    state.integrationKey = value;
    console.log("Integration key set.");
    configureClient();
  });

  ipcMain.handle(CHANNELS.SET_PASS, (_event, value) => {
    state.integrationPass = value;
    console.log("Integration password set.");
    configureClient();
  });

  ipcMain.handle(CHANNELS.TOGGLE_MODE, (_event, isChecked) => {
    state.isTest = !isChecked;
    console.log("Sandbox:", state.isTest);
    configureClient();
  });
}

// Single-record lookup, editor, update, and confirmation workflows.
function registerRecordHandlers(mainWindow) {
  ipcMain.handle(CHANNELS.SET_RECORD, async (_event, record) => {
    state.submittedRecord = record.targetId;
    state.submittedRecordType = record.targetType;
    console.log("Submitted ID:", record.targetId);
    console.log("Submitted type:", record.targetType);

    if (state.submittedRecord != "") {
      state.submittedResponse = await getRecord(
        state.submittedRecord,
        state.submittedRecordType,
      );
      return state.submittedResponse;
    }

    state.submittedResponse = "";
    return "";
  });

  ipcMain.handle(CHANNELS.CHANGE_RECORD, (_event, value) => {
    openRecordEditor(value.targetId);
  });

  ipcMain.handle(CHANNELS.CONFIRM_UPDATE, (_event, recordBody) => {
    state.submittedRecordBody = recordBody.data;
    openConfirmation(recordBody.isNewId ? "update-record" : "create-record");
  });

  ipcMain.handle(CHANNELS.UPDATE_CONFIRM, async () => {
    const response = await updateRecord(
      JSON.stringify(JSON.parse(state.submittedRecordBody)),
      state.submittedRecordType,
      state.submittedRecord,
    );
    try {
      console.log(await response.json());
    } catch {
      console.log("Update response contained no JSON body.");
    }

    state.submittedRecordBody = "";
    state.submittedRecord = "";
    send(
      mainWindow,
      CHANNELS.ACTION_RESPONSE,
      response.status == 200 ? "Update Successful" : response.statusText,
    );
    closeRecordEditor();
  });

  ipcMain.handle(CHANNELS.UPDATE_CANCEL, () => {
    closeRecordEditor();
  });

  ipcMain.handle(CHANNELS.CONFIRMATION_CANCEL, () => {
    closeConfirmation();
  });

  ipcMain.handle(CHANNELS.RECORD_INFO, () => ({
    submittedResponse: state.submittedResponse,
    submittedRecordType: state.submittedRecordType,
  }));
}

// File picker and CSV loading workflow.
function registerCSVHandlers(mainWindow) {
  ipcMain.handle(CHANNELS.OPEN_FILE_DIALOG, async () => {
    const response = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
    });

    if (response.canceled) {
      return null;
    }

    const fileName = response.filePaths[0];
    if (!fileName.toLowerCase().endsWith(".csv")) {
      return null;
    }

    let data;
    try {
      data = await loadData(fileName);
    } catch (error) {
      console.error("Failed to load CSV data:", error);
      return null;
    }

    state.recordList = data.recordList;
    state.displayedRecords = [];
    send(mainWindow, CHANNELS.FEED_BOX_CLEAR);
    send(mainWindow, CHANNELS.FEED_SOURCE, {
      detail: path.basename(fileName),
      label: "CSV",
      selectionLabel: path.basename(fileName),
    });
    send(mainWindow, CHANNELS.FEED_RECORDS_REPLACE, data.recordList);
    send(mainWindow, CHANNELS.SELECTED_FILE_COUNT, data.recordList.length);
    return fileName;
  });
}

// Single and bulk deletion commands, including pause/resume/retry controls.
function registerDeletionHandlers(mainWindow) {
  const deletionManager = createDeletionManager({
    deleteRecord,
    maxConcurrency: 5,
    onProgress: (progress) => {
      send(mainWindow, CHANNELS.DELETION_PROGRESS, progress);
    },
    onResult: (result) => {
      const message = result.ok
        ? `${result.id}: Deleted successfully.`
        : result.error
          ? `${result.id}: Delete error — ${result.error}`
          : `${result.id}: Delete failed (status ${result.status}).`;
      send(mainWindow, CHANNELS.FEED_BOX, message);
    },
  });

  function startDeletion(records) {
    closeConfirmation();
    send(mainWindow, CHANNELS.FEED_BOX_CLEAR);
    return deletionManager.start({
      records,
      deleteType: state.deleteType,
    });
  }

  ipcMain.handle(CHANNELS.BULK_DELETE_RECORD, (_event, { ids }) =>
    startDeletion(ids),
  );

  ipcMain.handle(CHANNELS.ACTIVATE_TEXT_LIST, (_event, { count }) => {
    // Pasted IDs use their own action buttons, so remove any stale CSV/portal list.
    state.recordList = [];
    state.displayedRecords = [];
    send(mainWindow, CHANNELS.FEED_BOX_CLEAR);
    send(mainWindow, CHANNELS.FEED_SOURCE, {
      detail: `${count} pasted record ID${count === 1 ? "" : "s"}`,
      label: "Text list",
      selectionLabel: "Pasted text list",
    });
    send(mainWindow, CHANNELS.SELECTED_FILE_COUNT, {
      count: 0,
      displayText: `${count} ID${count === 1 ? "" : "s"} in text list`,
    });
    return { count };
  });

  ipcMain.handle(CHANNELS.FETCH_PORTAL_CUSTOMERS, async () => {
    const currentDeletion = deletionManager.getSnapshot();
    if (["running", "cancelling", "paused"].includes(currentDeletion.status)) {
      return {
        error: "Finish or continue the current deletion before loading another list.",
      };
    }

    let customerIds;
    try {
      customerIds = await listCustomerIds();
    } catch (error) {
      console.error("Failed to load portal customers:", error);
      return {
        error: `Could not load portal customers: ${error.message}. Check the connection settings and try again.`,
      };
    }

    state.recordList = customerIds;
    state.displayedRecords = [];
    send(mainWindow, CHANNELS.FEED_BOX_CLEAR);
    send(mainWindow, CHANNELS.FEED_SOURCE, {
      detail: "All customers in the connected portal",
      label: "Portal",
      selectionLabel: "Portal customer list",
    });
    send(mainWindow, CHANNELS.FEED_RECORDS_REPLACE, customerIds);
    send(mainWindow, CHANNELS.SELECTED_FILE_COUNT, customerIds.length);

    return { count: customerIds.length };
  });

  ipcMain.handle(CHANNELS.DELETE_RECORD, () => {
    openConfirmation("delete-record");
  });

  ipcMain.handle(CHANNELS.DELETE_CONFIRM, async () => {
    const result = await deleteRecord(state.submittedRecord, state.deleteType);
    console.log(result);
    send(mainWindow, CHANNELS.ACTION_RESPONSE, "Record Deleted");
    state.submittedRecord = "";
    closeConfirmation();
  });

  ipcMain.handle(CHANNELS.DELETE_ALL, () => {
    openConfirmation("delete-all");
  });

  ipcMain.handle(CHANNELS.DELETE_ALL_CONFIRM, async () => {
    const deletion = startDeletion(state.recordList);
    state.recordList = [];
    return deletion;
  });

  ipcMain.handle(CHANNELS.DELETE_DISPLAYED, (_event, records) => {
    state.displayedRecords = records;
    openConfirmation("delete-displayed");
  });

  ipcMain.handle(CHANNELS.DELETE_DISPLAYED_CONFIRM, async () => {
    const deletion = startDeletion(state.displayedRecords);
    state.displayedRecords = [];
    return deletion;
  });

  ipcMain.handle(CHANNELS.TOGGLE_DELETE, (_event, deleteFullAccount) => {
    // Set from the checkbox value instead of blindly flipping session state.
    state.deleteType = deleteFullAccount ? "Full" : "Partial";
    console.log("Delete type:", state.deleteType);
    return state.deleteType;
  });

  ipcMain.handle(CHANNELS.GET_DELETE_SCOPE, () => state.deleteType);

  ipcMain.handle(CHANNELS.DELETE_ACCOUNT, () => {
    openConfirmation("delete-account");
  });

  ipcMain.handle(CHANNELS.DELETE_ACCOUNT_CONFIRM, () => {
    console.log("ACCOUNT:", state.submittedRecord, "DELETED.");
    closeConfirmation();
    deleteRecord(state.submittedRecord, "Full");
    send(mainWindow, CHANNELS.ACTION_RESPONSE, "Account Deleted");
  });

  ipcMain.on(CHANNELS.CANCEL_DELETION, () => {
    deletionManager.cancel();
  });

  ipcMain.handle(CHANNELS.RESUME_DELETION, () => deletionManager.resume());

  ipcMain.handle(CHANNELS.RETRY_FAILED_DELETIONS, () =>
    deletionManager.retryFailed(),
  );
}

function setupIPCHandlers(mainWindow) {
  // This is the only registration point called by the Electron entry module.
  registerConfigurationHandlers();
  registerRecordHandlers(mainWindow);
  registerCSVHandlers(mainWindow);
  registerDeletionHandlers(mainWindow);
}

module.exports = { setupIPCHandlers };
