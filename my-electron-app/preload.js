const { contextBridge, ipcRenderer} = require("electron");
const path = require('path');

//Functioned defined to display app versions
contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

//Functions defined to be used in renderer.js for all functions involved with inputting integration credentials
contextBridge.exposeInMainWorld("config", {
  setPortal:(value) => ipcRenderer.invoke("portalName", value),
  setKey: (value) => ipcRenderer.invoke("integrationKey", value),
  setPass: (value) => ipcRenderer.invoke("integrationPass", value),
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

contextBridge.exposeInMainWorld("customer", {
  setRecord:(value) => ipcRenderer.invoke("record", value)
})

contextBridge.exposeInMainWorld("dialog", {
  openFileSelect: () => {
    return ipcRenderer.invoke("openFileDialog").then((filePath) => {
      if (filePath) return { filePath, fileName: path.basename(filePath) }; // Return the filePath object if it exists
    }).catch((error) => {
      console.error("Error in openFileSelect:", error);
      throw error;
    });
  }
});
