/**
 * Renderer access seam.
 * Defines the complete window.api interface available to browser pages. Expose
 * new trusted capabilities here only when a renderer needs them.
 */
const path = require("path");
const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = require("../shared/channels.js");

contextBridge.exposeInMainWorld("api", {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },

  comm: {
    CHANNELS,
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, value) => ipcRenderer.invoke(channel, value),
    receive: (channel, callback) =>
      ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
  },

  dialog: {
    openFileSelect: () =>
      ipcRenderer
        .invoke(CHANNELS.OPEN_FILE_DIALOG)
        .then((filePath) => {
          if (filePath) {
            return { filePath, fileName: path.basename(filePath) };
          }
        })
        .catch((error) => {
          console.error("Error in openFileSelect:", error);
          return error.message;
        }),
  },
});
