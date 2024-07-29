// Displaying application versions
const information = document.getElementById("info");
information.innerText = `This app is using Chrome (v${api.versions.chrome()}), Node.js (v${api.versions.node()}), and Electron (v${api.versions.electron()})`;

// Main Window Objects
const portalField = document.getElementById("portalName");
const keyField = document.getElementById("intKey");
const passField = document.getElementById("intPass");
const configButton = document.getElementById("configButton");
const saveconfirm = document.getElementById("save-confirmation");
const selectFileButton = document.getElementById("selectFileButton");
const selectedFileName = document.getElementById("selectedFile");
const feed = document.getElementById("feedBox");
const recordButton = document.getElementById("recordSubmit");
const recordField = document.getElementById("recordID");
const fileCount = document.getElementById("fileCount");
const filesDisplayed = document.getElementById("filesDisplayed");
const recordOptions = document.getElementById("recordOptions");
const searchBar = document.getElementById("searchBar");
const recordType = document.getElementById("recordType");
const deletionOptions = document.getElementById("deleteRecordOptions");

// Buttons
const changeRecordButton = document.createElement("button");
const deleteRecordButton = document.createElement("button");
const deleteAllRecords = document.createElement("button");
const deleteDisplayed = document.createElement("button");

// Variables
let hideTimer = null;
let targetId;
let targetType = "customers";
let displayedRecords = [];
let allRecords = [];

// Event names
const EVENTS = {
  SET_PORTAL: "PORTAL-NAME",
  SET_KEY: "INTEGRATION-KEY",
  SET_PASS: "INTEGRATION-PASS",
  SET_RECORD: "RECORD",
  CHANGE_RECORD: "CHANGE-RECORD-BUTTON",
  DELETE_RECORD: "DELETE-RECORD-BUTTON",
  RECORD_RETRIEVE: "RECORD-RETRIEVAL",
  OPEN_FILE_DIALOG: "OPEN-FILE-DIALOG",
  FEED_BOX_CLEAR: "FEED-BOX-CLEAR",
  FEED_BOX: "FEED-BOX",
  SELECTED_FILE_COUNT: "RECORD-COUNT",
  RECORD_INFO: "GET-RECORD-DETAILS",
  CONFIRM_UPDATE: "CONFIRM-UPDATE",
  UPDATE_CONFIRM: "UPDATE-CONFIRM",
  DELETE_CONFIRM: "DELETE-CONFIRM",
  UPDATE_CANCEL: "UPDATE-CANCEL",
  CONFIRMATION_CANCEL: "CONFIRMATION-CANCEL",
  DELETE_ALL: "DELETE-ALL",
  DELETE_ALL_CONFIRM: "DELETE-ALL-CONFIRM",
  DELETE_DISPLAYED: "DELETE-DISPLAYED",
  DELETE_DISPLAYED_CONFIRM: "DELETE-DISPLAYED-CONFIRM",
};

// Function to handle clearing the save confirmation message
function clearSaveConfirmation() {
  saveconfirm.textContent = "";
}

// Function to show the save confirmation message and start the hide timer
function showSaveConfirmation(message) {
  saveconfirm.textContent = message;
  clearTimeout(hideTimer); // Clear any existing hide timer
  hideTimer = setTimeout(clearSaveConfirmation, 3000); // Start the hide timer after 3 seconds
}

// Save button click handler
configButton.addEventListener("click", () => {
  const portalValue = portalField.value;
  const keyValue = keyField.value;
  const passValue = passField.value;
  window.api.comm.invoke(EVENTS.SET_PORTAL, portalValue);
  window.api.comm.invoke(EVENTS.SET_KEY, keyValue);
  window.api.comm.invoke(EVENTS.SET_PASS, passValue);

  showSaveConfirmation("Integration Credentials Saved.");
});

// Open file selector button click handler
selectFileButton.addEventListener("click", () => {
  window.api.dialog.openFileSelect().then((file) => {
    if (file) {
      console.log(file);
      selectedFile.textContent = file.fileName;
      deleteAllRecords.id = "deleteAllRecords";
      deleteAllRecords.textContent = "Delete All";
      deletionOptions.appendChild(deleteAllRecords);
    } else {
      console.log("No file selected");
      selectedFile.textContent = "";
    }
  });
});

// Receiving record retrieval event
window.api.comm.receive(EVENTS.RECORD_RETRIEVE, (message) => {
  if (message) {
    changeRecordButton.id = "changeRecordButton";
    changeRecordButton.textContent = "View/Change Record";
    recordOptions.appendChild(changeRecordButton);

    deleteRecordButton.id = "deleteRecordButton";
    deleteRecordButton.textContent = "Delete Record";
    recordOptions.appendChild(deleteRecordButton);
  } else {
    recordOptions.textContent = "";
  }
});

// Change and delete record button click handlers
changeRecordButton.addEventListener("click", () => {
  window.api.comm.invoke(EVENTS.CHANGE_RECORD, targetId);
});

deleteRecordButton.addEventListener("click", () => {
  window.api.comm.invoke(EVENTS.DELETE_RECORD, targetId);
});

// Record button click handler
recordButton.addEventListener("click", () => {
  targetId = recordField.value;
  window.api.comm.invoke(EVENTS.SET_RECORD, { targetId, targetType });
});

// Record type change handler
recordType.addEventListener("change", () => {
  targetType = recordType.value;
  console.log(targetType);
});

// Receiving feed box and feed box clear events
window.api.comm.receive(EVENTS.FEED_BOX, (message) => {
  feed.insertAdjacentHTML("beforeend", `<div>${message}</div>`);
});

window.api.comm.receive(EVENTS.FEED_BOX_CLEAR, () => {
  feed.textContent = "";
});

// Search bar input handler
searchBar.addEventListener("input", () => {
  const searchTerm = searchBar.value.toLowerCase();
  const feedItems = feed.getElementsByTagName("div");
  let displayCount = 0;
  let currentDisplayed = [];

  Array.from(feedItems).forEach((item) => {
    if (item.textContent.toLowerCase().indexOf(searchTerm) !== -1) {
      item.style.display = "";
      displayCount++;
      currentDisplayed.push(item.textContent);
    } else {
      item.style.display = "none";
    }
  });

  displayedRecords = currentDisplayed;

  filesDisplayed.textContent = displayCount != fileCount.value ? displayCount + "/" : "";

  if (displayCount != fileCount.value && displayCount > 0) {
    deleteDisplayed.id = "deleteDisplayed";
    deleteDisplayed.textContent = "Delete Displayed";
    deletionOptions.appendChild(deleteDisplayed);
  } else {
    deletionOptions.textContent = "";
    deletionOptions.appendChild(deleteAllRecords);
  }
});

// Delete all and delete displayed records button click handlers
deleteAllRecords.addEventListener("click", () => {
  window.api.comm.invoke(EVENTS.DELETE_ALL);
});

deleteDisplayed.addEventListener("click", () => {
  window.api.comm.invoke(EVENTS.DELETE_DISPLAYED, displayedRecords);
});

// Receiving selected file count event
window.api.comm.receive(EVENTS.SELECTED_FILE_COUNT, (value) => {
  fileCount.textContent = value ? value + " records loaded" : "";
  fileCount.value = value;
});
