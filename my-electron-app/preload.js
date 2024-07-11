const { contextBridge, ipcRenderer, dialog } = require('electron');

//Functioned defined to display app versions
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

//Functions defined to be used in renderer.js for all functions involved with inputting integration credentials
contextBridge.exposeInMainWorld('int', {
    setKey:(value) => ipcRenderer.invoke("integrationKey", value),
    setPass:(value) => ipcRenderer.invoke("integrationPass", value),
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
    });

//Functions defined for file selector functionality
window.addEventListener('DOMContentLoaded', () => {
    const disableAutofill = () => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
      });
    };
  
    disableAutofill();
  });
  