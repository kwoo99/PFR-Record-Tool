const { BrowserWindow } = require("electron");
const path = require("path");

let popupWindow;
let confirmationWindow;

function createPopupWindow(html, mode, title, mainWindow) {
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
      .executeJavaScript(
        `
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `
      )
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
      .executeJavaScript(
        `
        new Promise((resolve) => {
          const wrapper = document.querySelector('.wrapper');
          const width = Math.max(wrapper.scrollWidth, 400);
          const height = Math.max(wrapper.scrollHeight, 150);
          resolve({ width, height });
        });
      `
      )
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


function closePopupWindow() {
  if (popupWindow) {
    popupWindow.close();
  }
}

function closeConfirmationWindow() {
  if (confirmationWindow) {
    confirmationWindow.close();
  }
}

module.exports = {
  createPopupWindow,
  createConfirmationWindow,
  closePopupWindow,
  closeConfirmationWindow,
};
