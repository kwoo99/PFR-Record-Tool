/**
 * Electron application entry point.
 * Owns process lifecycle and creation of the main window. Feature behavior is
 * registered through the IPC module instead of being implemented here.
 */
const path = require("path");
const { app, BrowserWindow } = require("electron");

const { setupIPCHandlers } = require("./ipc/register-handlers.js");
const { configure } = require("./payfabric/client.js");

let mainWindow;

// Establish safe defaults before the user supplies session credentials.
configure({
  sandbox: true,
  portalName: "",
  integrationKey: "",
  integrationPass: "",
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 695,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/main/index.html"));
  mainWindow.on("closed", () => {
    app.quit();
  });

  // Connect renderer actions to the trusted main-process feature modules.
  setupIPCHandlers(mainWindow);
}

// Application lifecycle controls.
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
