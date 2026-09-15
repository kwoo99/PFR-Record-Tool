/**
 * Secondary-window lifecycle module.
 * Owns record-editor and confirmation window creation, sizing, reuse, and close
 * behavior. Add or rename popup pages in this file.
 */
const path = require("path");
const { BrowserWindow } = require("electron");

const PRELOAD_PATH = path.join(__dirname, "../../preload/index.js");
const RENDERER_PATH = path.join(__dirname, "../../renderer");

// Maps workflow names used by IPC handlers to their renderer page.
const CONFIRMATION_PAGES = Object.freeze({
  "create-record": "create-record.html",
  "delete-account": "delete-account.html",
  "delete-all": "delete-all.html",
  "delete-displayed": "delete-displayed.html",
  "delete-record": "delete-record.html",
  "update-record": "update-record.html",
});

let recordEditorWindow;
let confirmationWindow;
let helpWindow;

function showWindowWhenSized(targetWindow) {
  // Size popups from their rendered wrapper before showing them to the user.
  targetWindow.webContents.on("did-finish-load", () => {
    targetWindow.webContents
      .executeJavaScript(`
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `)
      .then(({ width, height }) => {
        targetWindow.setContentSize(width, height);
        targetWindow.center();
        targetWindow.show();
      });
  });
}

function createManagedWindow({ htmlPath, modal, parent, title }) {
  const targetWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent,
    modal,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
      sandbox: false,
    },
  });

  targetWindow.loadFile(htmlPath);
  if (title) {
    targetWindow.setTitle(title);
  }
  showWindowWhenSized(targetWindow);

  return targetWindow;
}

function openRecordEditor(recordId) {
  if (recordEditorWindow) {
    recordEditorWindow.focus();
    return;
  }

  recordEditorWindow = createManagedWindow({
    htmlPath: path.join(RENDERER_PATH, "record-editor/index.html"),
    modal: false,
    title: `VIEW/UPDATE ${recordId}`,
  });
  recordEditorWindow.on("closed", () => {
    recordEditorWindow = null;
  });
}

function openConfirmation(page) {
  const fileName = CONFIRMATION_PAGES[page];
  if (!fileName) {
    throw new Error(`Unknown confirmation page: ${page}`);
  }

  confirmationWindow = createManagedWindow({
    htmlPath: path.join(RENDERER_PATH, "confirmations", fileName),
    modal: true,
    parent: BrowserWindow.getFocusedWindow(),
  });
  confirmationWindow.on("closed", () => {
    confirmationWindow = null;
  });
}

function closeRecordEditor() {
  if (recordEditorWindow) {
    recordEditorWindow.close();
  }
}

function closeConfirmation() {
  if (confirmationWindow) {
    confirmationWindow.close();
  }
}

function openHelpWindow() {
  if (helpWindow) {
    helpWindow.focus();
    return;
  }

  helpWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: "PFR Record Tool Help",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
      sandbox: false,
    },
  });
  helpWindow.once("ready-to-show", () => helpWindow.show());
  helpWindow.on("closed", () => {
    helpWindow = null;
  });
  helpWindow
    .loadFile(path.join(RENDERER_PATH, "help/index.html"))
    .catch((error) => {
      console.error("Could not open Help:", error);
      helpWindow?.destroy();
      helpWindow = null;
    });
}

module.exports = {
  closeConfirmation,
  closeRecordEditor,
  openConfirmation,
  openHelpWindow,
  openRecordEditor,
};
