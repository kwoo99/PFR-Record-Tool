const { app, BrowserWindow } = require("electron");
const path = require("path");
const { setupIPCHandlers } = require("./ipcHandlers.js");
const { config } = require("./api.js");

let mainWindow
config(true, "", "", "");

function createMainWindow() {
   mainWindow = new BrowserWindow({
    width: 880,
    height: 695,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("./html/index.html");

  mainWindow.on("closed", () => {
    app.quit();
  });

  setupIPCHandlers(mainWindow);
}

app.on("ready", createMainWindow);

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
