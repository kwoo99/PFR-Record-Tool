const { ipcMain, dialog } = require("electron");
const path = require("path");
const { config, getRecord, deleteRecord, updateRecord } = require("./api.js");
const {
  createPopupWindow,
  createConfirmationWindow,
  closeConfirmationWindow,
  closePopupWindow,
} = require("./windowFunctions.js");
const { loadData } = require("./loadData.js");
const CHANNELS = require("./channels.js");

let portalName = "";
let integrationKey = "";
let integrationPass = "";
let fileName = "";
let submittedRecord = "";
let submittedRecordType = "";
let submittedResponse = null;
let recordList = [];
let displayedRecords = [];
let isTest = true;
let deleteType = "Partial";
let deleteCount = 0;
let submittedRecordBody;

function setupIPCHandlers(mainWindow) {
  ipcMain.handle(CHANNELS.SET_PORTAL, (_event, value) => {
    portalName = value;
    console.log("Portal Name set to:", portalName);
    config(isTest, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(CHANNELS.SET_KEY, (_event, value) => {
    integrationKey = value;
    console.log("Integration key set to:", integrationKey);
    config(isTest, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(CHANNELS.SET_PASS, (_event, value) => {
    integrationPass = value;
    console.log("Integration password set to:", integrationPass);
    config(isTest, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(CHANNELS.SET_RECORD, async (_event, record) => {
    submittedRecord = record.targetId;
    submittedRecordType = record.targetType;
    console.log("Submitted ID: " + record.targetId);
    console.log("Submitted Type: " + record.targetType);

    console.log("Portal Name: " + portalName);
    console.log("Int Key: " + integrationKey);
    console.log("Int Pass: " + integrationPass); 

    if (submittedRecord != "") {
      response = await getRecord(submittedRecord, submittedRecordType);
      console.log("Received response");
      submittedResponse = response;
      return submittedResponse;
    } else {
      submittedResponse = "";
      return "";
    }
  });

  ipcMain.handle(CHANNELS.CHANGE_RECORD, async (_event, value) => {
    const htmlPath = path.join(__dirname, "./html/updateRecord.html");
    const windowTitle = "VIEW/UPDATE " + value.targetId;
    createPopupWindow(htmlPath, false, windowTitle);
  });

  ipcMain.handle(CHANNELS.DELETE_RECORD, (_event) => {
    const htmlPath = path.join(__dirname, "./html/delete.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(CHANNELS.OPEN_FILE_DIALOG, async () => {
    const response = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
    });
      if (!response.canceled) {
        if (path.extname(response.filePaths[0]) != '.csv') {
          mainWindow.webContents.send(CHANNELS.FEED_BOX_CLEAR);
          mainWindow.webContents.send(CHANNELS.SELECTED_FILE_COUNT, "");
          return null;
        } 
        fileName = response.filePaths[0];
        mainWindow.webContents.send(CHANNELS.FEED_BOX_CLEAR);
        const data = await loadData(fileName, mainWindow);
        recordList = data.recordList;
        recordListType = data.recordType;
        return fileName;
      } else {
        mainWindow.webContents.send(CHANNELS.FEED_BOX_CLEAR);
        mainWindow.webContents.send(CHANNELS.SELECTED_FILE_COUNT, "");
        return null;
      }
  });

  ipcMain.handle(CHANNELS.CONFIRM_UPDATE, (_event, recordBody) => {
    console.log("CONFIRM UPDATE.");
    submittedRecordBody = recordBody.data;
    if (!recordBody.isNewId) {
      console.log("NEW RECORD DETECTED.");
      const htmlPath = path.join(__dirname, "./html/createConfirm.html");
      createConfirmationWindow(htmlPath);
    } else {
      const htmlPath = path.join(__dirname, "./html/updateConfirm.html");
      createConfirmationWindow(htmlPath);
    }
  });

  ipcMain.handle(CHANNELS.UPDATE_CONFIRM, async (_event, ) => {
    console.log("UPDATE RECORD.");
    const response = await updateRecord(JSON.stringify(JSON.parse(submittedRecordBody)), submittedRecordType);
    const rawResponse = await response.json();
    console.log(rawResponse);
    submittedRecordBody = "";
    submittedRecord = "";
    console.log(response.status);
    if(response.status == 200){
      console.log("Sending Success");
      mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, "Update Successful");
    }
    else {
      console.log("Sending Failure");
      mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, response.statusText);
    }
    closePopupWindow();
  });

  ipcMain.handle(CHANNELS.DELETE_CONFIRM, async () => {
    console.log("DELETE RECORD.");
    const result = await deleteRecord(submittedRecord, deleteType);
    console.log(result);
    mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, "Record Deleted");
    submittedRecord = "";
    closeConfirmationWindow();
  });

  ipcMain.handle(CHANNELS.UPDATE_CANCEL, () => {
    console.log("UPDATE CANCELED.");
    closePopupWindow();
  });

  ipcMain.handle(CHANNELS.CONFIRMATION_CANCEL, () => {
    console.log("CONFIRMATION CANCELED.");
    closeConfirmationWindow();
  });

  ipcMain.handle(CHANNELS.RECORD_INFO, async () => {
    return { submittedResponse, submittedRecordType};
  });

  ipcMain.handle(CHANNELS.DELETE_ALL_CONFIRM, async () => {
    closeConfirmationWindow();
    mainWindow.webContents.send(CHANNELS.CLEAR_DELETE_OPTIONS, true);
    mainWindow.webContents.send(CHANNELS.FEED_BOX_CLEAR);
    for (let i = 0; i < recordList.length; i++){
      const result = await deleteRecord(recordList[i], deleteType);
      if (result.status == 200) {
        deleteMessage = `${recordList[i]} deleted successfully`;
        deleteCount++;
      } else {
        deleteMessage = `Failed to delete ${recordList[i]}`;
      }
      mainWindow.webContents.send(CHANNELS.FEED_BOX, deleteMessage);
      mainWindow.webContents.send(CHANNELS.DELETED_FILE_COUNT, deleteCount);
    }
    mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, "Records Deleted");
    deleteCount = 0;
    recordList = "";
  });

  ipcMain.handle(CHANNELS.DELETE_DISPLAYED_CONFIRM, async () => {
    closeConfirmationWindow();
    mainWindow.webContents.send(CHANNELS.CLEAR_DELETE_OPTIONS, true);
    mainWindow.webContents.send(CHANNELS.FEED_BOX_CLEAR);
    for (let i = 0; i < displayedRecords.length; i++){
      const result = await deleteRecord(displayedRecords[i], deleteType);
      if (result.status == 200) {
        deleteMessage = `${displayedRecords[i]} deleted successfully`;
        deleteCount++;
      } else {
        deleteMessage = `Failed to delete ${displayedRecords[i]}`;
      }
      mainWindow.webContents.send(CHANNELS.FEED_BOX, deleteMessage);
      mainWindow.webContents.send(CHANNELS.DELETED_FILE_COUNT, deleteCount);
    }
    mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, "Records Deleted");
    deleteCount = 0;
    displayedRecords = "";
  });

  ipcMain.handle(CHANNELS.DELETE_ALL, () => {
    const htmlPath = path.join(__dirname, "./html/deleteAll.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(CHANNELS.DELETE_DISPLAYED, (_event, Records) => { 
    displayedRecords = Records;
    const htmlPath = path.join(__dirname, "./html/deleteDisplayed.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(CHANNELS.TOGGLE_MODE, (_event, isChecked) => {
    isTest = !isChecked;
    console.log("Sandbox: " + isTest);
    config(isTest, portalName, integrationKey, integrationPass);
  });

  ipcMain.handle(CHANNELS.TOGGLE_DELETE, (_event) => {
    if (deleteType == "Partial") {
      deleteType = "Full";
    } else {
      deleteType = "Partial";
    }
    console.log(deleteType);
  });

  ipcMain.handle(CHANNELS.DELETE_ACCOUNT, () =>{
    const htmlPath = path.join(__dirname, "./html/deleteAccount.html");
    createConfirmationWindow(htmlPath);
  });

  ipcMain.handle(CHANNELS.DELETE_ACCOUNT_CONFIRM, () => {
    console.log("ACCOUNT: " + submittedRecord + " DELETED."); // CREATE API CALL TO DELETE ACCOUNT USING submittedRecord VARIABLE
    closeConfirmationWindow();
    deleteRecord(submittedRecord, "Full");
    mainWindow.webContents.send(CHANNELS.ACTION_RESPONSE, "Account Deleted");
  });
}

module.exports = { setupIPCHandlers };
