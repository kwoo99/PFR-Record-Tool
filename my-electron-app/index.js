const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { readCSVFile, getCSVType } = require("./csvParser.cjs");
const { config, getRecord } = require("./api.js");
const path = require("path");

// Constants for event names
const EVENTS = {
  SET_PORTAL: "PORTAL-NAME",
  SET_KEY: "INTEGRATION-KEY",
  SET_PASS: "INTEGRATION-PASS",
  SET_RECORD: "RECORD",
  CHANGE_RECORD: "CHANGE-RECORD-BUTTON",
  DELETE_RECORD: "DELETE-RECORD-BUTTON",
  RECORD_RETRIEVE: "RECORD-RETRIEVAL",
  OPEN_FILE_DIALOG: "OPEN-FILE-DIALOG",
  FEED_BOX_CLEAR: "FEED-BOX-CLEAR",
  FEED_BOX: "FEED-BOX",
  SELECTED_FILE_COUNT: "RECORD-COUNT",
  RECORD_INFO: "GET-RECORD-DETAILS",
  CONFIRM_UPDATE: "CONFIRM-UPDATE",
  UPDATE_CONFIRM: "UPDATE-CONFIRM",
  DELETE_CONFIRM: "DELETE-CONFIRM",
  UPDATE_CANCEL: "UPDATE-CANCEL",
  CONFIRMATION_CANCEL: "CONFIRMATION-CANCEL",
  DELETE_ALL: "DELETE-ALL",
  DELETE_ALL_CONFIRM: "DELETE-ALL-CONFIRM",
  DELETE_DISPLAYED: "DELETE-DISPLAYED",
  DELETE_DISPLAYED_CONFIRM: "DELETE-DISPLAYED-CONFIRM",
};

// Variables to hold state
let mainWindow;
let popupWindow;
let confirmationWindow;
let portalName = "";
let integrationKey = "";
let integrationPass = "";
let fileName = "";
let submittedRecord = "";
let submittedRecordType = "";
let recordList = [];
let displayedRecords = [];

// Initial configuration
config(true, portalName, integrationKey, integrationPass);

// Create the main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("./html/index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Create a popup window
function createPopupWindow(html, mode, title) {
  if (popupWindow) {
    popupWindow.focus();
    return;
  }

  popupWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent: mainWindow,
    modal: mode,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  popupWindow.loadFile(html);
  popupWindow.setTitle(title);

  popupWindow.webContents.on("did-finish-load", () => {
    popupWindow.webContents
      .executeJavaScript(`
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `)
      .then(({ width, height }) => {
        popupWindow.setContentSize(width, height);
        popupWindow.center();
        popupWindow.show();
      });
  });

  popupWindow.on("closed", () => {
    popupWindow = null;
  });
}

// Create a confirmation window
function createConfirmationWindow(html) {
  const parentWindow = BrowserWindow.getFocusedWindow();

  confirmationWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent: parentWindow,
    modal: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  confirmationWindow.loadFile(html);

  confirmationWindow.webContents.on("did-finish-load", () => {
    confirmationWindow.webContents
      .executeJavaScript(`
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `)
      .then(({ width, height }) => {
        confirmationWindow.setContentSize(width, height);
        confirmationWindow.center();
        confirmationWindow.show();
      });
  });

  confirmationWindow.on("closed", () => {
    confirmationWindow = null;
  });
}

// Create a response window
function createResponseWindow(html, mode, title) {
  const parentWindow = BrowserWindow.getFocusedWindow();

  const responseWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent: parentWindow,
    modal: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  responseWindow.loadFile(html);

  responseWindow.webContents.on("did-finish-load", () => {
    responseWindow.webContents
      .executeJavaScript(`
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `)
      .then(({ width, height }) => {
        responseWindow.setContentSize(width, height);
        responseWindow.center();
        responseWindow.show();
      });
  });

  responseWindow.on("closed", () => {
    responseWindow = null;
  });
}

// Load data from a CSV file
async function loadData(csvFile) {
  try {
    const recordType = await getCSVType(csvFile);
    recordList = await readCSVFile(csvFile, recordType);
    let recordCount = 0;
    for (const record of recordList) {
      mainWindow.webContents.send(EVENTS.FEED_BOX, record);
      recordCount++;
    }
    mainWindow.webContents.send(EVENTS.SELECTED_FILE_COUNT, recordCount);
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

// Set up IPC handlers
function setupIPCHandlers() {
  ipcMain.handle(EVENTS.SET_PORTAL, (_event, value) => {
    portalName = value;
    console.log("Portal Name set to:", portalName);
    config(true, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(EVENTS.SET_KEY, (_event, value) => {
    integrationKey = value;
    console.log("Integration key set to:", integrationKey);
    config(true, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(EVENTS.SET_PASS, (_event, value) => {
    integrationPass = value;
    console.log("Integration password set to:", integrationPass);
    config(true, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(EVENTS.SET_RECORD, (_event, record) => {
    submittedRecord = record.targetId;
    submittedRecordType = record.targetType;
    if (record.targetId != "") {
      console.log("Record Submitted:", submittedRecord);
      console.log("Record Type:", submittedRecordType);
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, true);
    } else {
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, false);
    }
  });

  ipcMain.handle(EVENTS.CHANGE_RECORD, async (_event, value) => {
    const htmlPath = path.join(__dirname, "./html/updateRecord.html");
    const windowTitle = "VIEW/UPDATE " + value;
    createPopupWindow(htmlPath, false, windowTitle);
  });

  ipcMain.handle(EVENTS.DELETE_RECORD, (_event) => {
    const htmlPath = path.join(__dirname, "./html/delete.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(EVENTS.OPEN_FILE_DIALOG, async () => {
    const response = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
    });
    if (!response.canceled) {
      fileName = response.filePaths[0];
      mainWindow.webContents.send(EVENTS.FEED_BOX_CLEAR);
      loadData(fileName);
      return fileName;
    } else {
      mainWindow.webContents.send(EVENTS.FEED_BOX_CLEAR);
      mainWindow.webContents.send(EVENTS.SELECTED_FILE_COUNT, "");
      return null;
    }
  });

  ipcMain.handle(EVENTS.CONFIRM_UPDATE, () => {
    console.log("CONFIRM UPDATE.");
    const htmlPath = path.join(__dirname, "./html/updateConfirm.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(EVENTS.UPDATE_CONFIRM, () => {
    console.log("UPDATE RECORD."); // CREATE API CALL TO UPDATE RECORD USING submittedRecord, submittedRecordType VARIABLES 
    submittedRecord = "";
    popupWindow.close();
  });

  ipcMain.handle(EVENTS.DELETE_CONFIRM, () => {
    console.log("DELETE RECORD."); // CREATE API CALL TO DELETE RECORD USING submittedRecord, submittedRecordType VARIABLES 
    submittedRecord = "";
    confirmationWindow.close();
  });

  ipcMain.handle(EVENTS.UPDATE_CANCEL, () => {
    console.log("UPDATE CANCELED.");
    popupWindow.close();
  });

  ipcMain.handle(EVENTS.CONFIRMATION_CANCEL, () => {
    console.log("CONFIRMATION CANCELED.");
    confirmationWindow.close();
  });

  ipcMain.handle(EVENTS.RECORD_INFO, async () => {
    const recordData = await getRecord(submittedRecord, submittedRecordType);
    return recordData;
  });

  ipcMain.handle(EVENTS.DELETE_ALL_CONFIRM, () => {
    console.log(recordList); // CREATE API CALL TO DELETE ALL RECORDS USING recordList ARRAY
    confirmationWindow.close();
  });

  ipcMain.handle(EVENTS.DELETE_DISPLAYED_CONFIRM, () => {
    console.log(displayedRecords); // CREATE API CALL TO DELETE DISPLAYED RECORDS USING displayedRecords ARRAY
    confirmationWindow.close();
  });

  ipcMain.handle(EVENTS.DELETE_ALL, () => {
    const htmlPath = path.join(__dirname, "./html/deleteAll.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(EVENTS.DELETE_DISPLAYED, (_event, Records) => {
    displayedRecords = Records;
    const htmlPath = path.join(__dirname, "./html/deleteDisplayed.html");
    createConfirmationWindow(htmlPath);
  });
}

// App event listeners
app.on("ready", () => {
  createMainWindow();
  setupIPCHandlers();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
