const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { readCSVFile, getCSVType } = require("./csvParser.cjs");
// const {} = require("./api.js"); //import api functions 
const path = require("path");

// Constants for event names
const EVENTS = {
  SET_PORTAL: "portal-Name",
  SET_KEY: "integration-Key",
  SET_PASS: "integration-Pass",
  SET_RECORD: "record",
  CHANGE_RECORD: "change-Record-Button",
  DELETE_RECORD: "delete-Record-Button",
  RECORD_RETRIEVE: "record-Retrieval",
  OPEN_FILE_DIALOG: "open-File-Dialog",
  FEED_BOX_CLEAR: "feed-Box-Clear",
  FEED_BOX: "feed-Box",
  SELECTED_FILE_COUNT: "record-Count",
  RECORD_INFO: "get-Record-Details"
};

// Variables to hold state
let mainWindow;
let popupWindow;

let portalName = '';
let integrationKey = '';
let integrationPass = '';
let fileName = '';
let submittedRecord = '';

// Create the main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 840,
    height: 695,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("./html/index.html");

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create the popup window
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

  popupWindow.webContents.on('did-finish-load', () => {
    popupWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const wrapper = document.querySelector('.wrapper');
        const width = Math.max(wrapper.scrollWidth, 400); // Minimum width
        const height = Math.max(wrapper.scrollHeight, 150); // Minimum height
        resolve({ width, height });
      });
    `).then(({ width, height }) => {
      popupWindow.setContentSize(width, height);
      popupWindow.center(); // Optional: to re-center the window after resizing
      popupWindow.show(); // Show the window after resizing
    });
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

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

  confirmationWindow.webContents.on('did-finish-load', () => {
    confirmationWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const wrapper = document.querySelector('.wrapper');
        const width = Math.max(wrapper.scrollWidth, 400); // Minimum width
        const height = Math.max(wrapper.scrollHeight, 150); // Minimum height
        resolve({ width, height });
      });
    `).then(({ width, height }) => {
      confirmationWindow.setContentSize(width, height);
      confirmationWindow.center(); // Optional: to re-center the window after resizing
      confirmationWindow.show(); // Show the window after resizing
    });
  });

  confirmationWindow.on('closed', () => {
    confirmationWindow = null;
  });
}

function createResponsenWindow(html, mode, title) {
  const parentWindow = BrowserWindow.getFocusedWindow();

  responseWindow = new BrowserWindow({
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

  responseWindow.webContents.on('did-finish-load', () => {
    responseWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const wrapper = document.querySelector('.wrapper');
        const width = Math.max(wrapper.scrollWidth, 400); // Minimum width
        const height = Math.max(wrapper.scrollHeight, 150); // Minimum height
        resolve({ width, height });
      });
    `).then(({ width, height }) => {
      responseWindow.setContentSize(width, height);
      responseWindow.center(); // Optional: to re-center the window after resizing
      responseWindow.show(); // Show the window after resizing
    });
  });

  responseWindow.on('closed', () => {
    responseWindow = null;
  });
}



// Load data from a CSV file
async function loadData(csvFile) {
  try {
    const recordType = await getCSVType(csvFile);
    const recordList = await readCSVFile(csvFile, recordType);
    let recordCount = 0;
    for (const record of recordList) {
      mainWindow.webContents.send(EVENTS.FEED_BOX, record);
      recordCount++;
    }
    mainWindow.webContents.send(EVENTS.SELECTED_FILE_COUNT, `${recordCount} records loaded.`);
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

// Set up IPC handlers
function setupIPCHandlers() {
  ipcMain.handle(EVENTS.SET_PORTAL, (_event, value) => {
    portalName = value;
    console.log("Portal Name set to:", portalName);
  });

  ipcMain.handle(EVENTS.SET_KEY, (_event, value) => {
    integrationKey = value;
    console.log("Integration key set to:", integrationKey);
  });

  ipcMain.handle(EVENTS.SET_PASS, (_event, value) => {
    integrationPass = value;
    console.log("Integration password set to:", integrationPass);
  });

  ipcMain.handle(EVENTS.SET_RECORD, (_event, value) => { 
    submittedRecord = value;
    if(value != '') { // REPLACE '' LOGIC TO CHECK WITH API CALL IF RECORD EXISTS
      console.log("Record Submitted:", submittedRecord);
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, true);
    } 
    else {
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, false);
    }
  });


  ipcMain.handle(EVENTS.CHANGE_RECORD, async (_event, value) => {
    const htmlPath = path.join(__dirname, "./html/editRecord.html");
    const windowTitle = "VIEW/UPDATE " + value;
    createPopupWindow(htmlPath, false, windowTitle);
  });

  ipcMain.handle(EVENTS.DELETE_RECORD, async (_event, value) => {
    const htmlPath = path.join(__dirname, "./html/deleteConfirm.html");
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
      mainWindow.webContents.send(EVENTS.SELECTED_FILE_COUNT, '');
      return null;
    }
  });

  ipcMain.handle("confirm-Update", () => {
    console.log("CONFIRM UPDATE.");
    const htmlPath = path.join(__dirname, "./html/updateConfirm.html");
    createConfirmationWindow(htmlPath)
  });

  ipcMain.handle("update-Confirmed", () => {
    // ADD API CALL TO UPDATE RECORD USING submittedRecord
    console.log("UPDATE SUCCESSFUL.");
    submittedRecord = '';
    popupWindow.close()
  });

  ipcMain.handle("delete-Confirmed", () => {
    // ADD API CALL TO DELETE RECORD USING submittedRecord
    console.log("DELETE SUCCESSFUL.");
    submittedRecord = '';
    confirmationWindow.close()
  });

  ipcMain.handle("update-Cancel", () => {
    console.log("UPDATE CANCELED.");
    confirmationWindow.close();
  });

  ipcMain.handle("delete-Cancel", () => {
    console.log("DELETE CANCELED.");
    confirmationWindow.close();
  })

  ipcMain.handle(EVENTS.CUSTOMER_INFO, async () => { 
    const customerData = ''; // REPLACE '' WITH API CALL TO GET CUSTOMER INFO
    return customerData;
  });

}

// App event listeners
app.on('ready', () => {
  createMainWindow();
  setupIPCHandlers();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
