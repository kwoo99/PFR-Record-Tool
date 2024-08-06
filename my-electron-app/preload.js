const { contextBridge, ipcRenderer } = require("electron");
const path = require('path');
const CHANNELS = require("./channels.js");

contextBridge.exposeInMainWorld("api", {
  // Versions
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },

  // Communication
  comm: {
    CHANNELS,
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, value) => ipcRenderer.invoke(channel, value),
    receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  },

  // Dialog
  dialog: {
    openFileSelect: () => {
      return ipcRenderer.invoke(CHANNELS.OPEN_FILE_DIALOG).then((filePath) => {
        if (filePath) return { filePath, fileName: path.basename(filePath) }; // Return the filePath object if it exists
      }).catch((error) => {
        console.error("Error in openFileSelect:", error);
        throw error;
      });
    }
  }
});
