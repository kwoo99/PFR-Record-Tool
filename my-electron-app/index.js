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
  CUSTOMER_INFO: "customer-Info"
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
    if(value != '') { // ADD LOGIC TO CHECK WITH API CALL IF RECORD EXISTS
      console.log("Record Submitted:", submittedRecord);
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, true);
    } 
    else {
      mainWindow.webContents.send(EVENTS.RECORD_RETRIEVE, false);
    }
  });

  // ipcMain.handle(EVENTS.VIEW_RECORD, async () => {
  //   console.log("VIEW RECORD");
  // });

  ipcMain.handle(EVENTS.CHANGE_RECORD, async (_event, value) => {
    console.log("CHANGE RECORD");
    const htmlPath = path.join(__dirname, "./html/editRecord.html");
    const windowTitle = "VIEW/UPDATE " + value;
    createPopupWindow(htmlPath, false, windowTitle);
  });

  ipcMain.handle(EVENTS.DELETE_RECORD, async (_event, value) => {
    console.log("DELETE RECORD");
    const htmlPath = path.join(__dirname, "./html/deleteConfirm.html");
    const windowTitle = "DELETE " + value;
    createPopupWindow(htmlPath, true, windowTitle);
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

  ipcMain.handle("confirmed", () => {
    // ADD API CALL TO DELETE RECORD
    submittedRecord = '';
    popupWindow.close()
  })

  ipcMain.handle("canceled", () => {
    popupWindow.close();
  });

  // ipcMain.handle(EVENTS.CUSTOMER_INFO, async () => { //CREATE API CALL TO GET CUSTOMER INFO
  //   // const response = 
  //   const customerData = [response.]
  //   return customerData;
  // });

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
