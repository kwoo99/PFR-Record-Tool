const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { readCSVFile, getCSVType } = require("./csvParser.cjs");
const path = require("path");

var portalName = ''
var integrationKey = '';
var integrationPass = '';
var fileName = '';
var selectedCustomers = [];

// Create a window instance
const createWindow = () => {

  try {
    const win = new BrowserWindow({
      width: 840,
      height: 640,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    async function loadData(csvFile) {
      var recordType = await getCSVType(csvFile);
      var recordList = await readCSVFile(csvFile, recordType);
      var recordCount = 0;
      for (let i = 0;i < recordList.length; i++){
        win.webContents.send("feedBox", recordList[i]);
        recordCount++;
      }
      win.webContents.send("selectedFileName", `${recordCount} records ids loaded`);
    }

    win.loadFile("index.html");

    // Handles incoming communication for integration credential inputs from renderer.js using ipcRenderer/ipcMain communication
    ipcMain.handle("portalName", async (_event, value) => {
      portalName = value;
      console.log("Portal Name set to:" + portalName);
    });
    
    ipcMain.handle("integrationKey", async (_event, value) => {
      integrationKey = value;
      console.log("Integration key set to:" + integrationKey);
    });

    ipcMain.handle("integrationPass", async (_event, value) => {
      integrationPass = value;
      console.log("Integration password set to:" + integrationPass);
    });
    
    // Will send message back to renderer once signal for button click is received from renderer.js
    ipcMain.on("button-clicked", (event) => {
      win.webContents.send("saveconfirm", "Integration Credentials Saved.");
    });

    //Accepts and returns a single file to renderer once select file button is pressed
    ipcMain.handle("openFileDialog", async () => {
      const response = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
      });
      if (!response.canceled) {
        fileName = response.filePaths[0];
        win.webContents.send("feedBoxClear");
        console.log('loadDATA');
        loadData(fileName);
        return fileName;
      } else {
        win.webContents.send("feedBoxClear"); 
        return null;
      }
    });
  } catch (error) {
    console.error("Failed to create the window:", error);
  }
};

//Creates window instance when all apps are ready
app.whenReady().then(() => {
  // console.log("Preload script path:", path.join(__dirname, "preload.js"));
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
