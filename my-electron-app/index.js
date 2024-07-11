const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { readCSVFile } = require('./csvParser.cjs');
const path = require('node:path');

var integrationKey = 0;
var integrationPass = 0;

// Create a window instance
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
  });

  win.loadFile('index.html');

  // Handles incoming communication for integration credential inputs from renderer.js using ipcRenderer/ipcMain communication
  ipcMain.handle("integrationKey", async (_event, value) => {
    integrationKey = value;
    console.log('Integration key set to:' + integrationKey);
  });

  ipcMain.handle("integrationPass", async (_event, value) => {
    integrationPass = value;
    console.log('Integration password set to:' + integrationPass);
  });

// Will send message back to renderer once signal for button click is received from renderer.js
  ipcMain.on('button-clicked', (event) => {
    win.webContents.send('saveconfirm', 'Integration Credentials Saved.');
  });
  

};

//Creates window instance when all apps are ready
app.whenReady().then(() => {
    createWindow()

//     dialog.showOpenDialog({properties: ['openFile'] }).then(async function (response) {
//     if (!response.canceled) {

//         filePath = response.filePaths[0];

//         readCSVFile(filePath)
//         .then((response) => console.log(response))
//         .catch((error) => console.error(error));

//       console.log(response.filePaths[0]);
//     } else {
//       console.log("no file selected");
//     }
// });

    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })
