const { CHANNELS } = window.api.comm;
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
const feed = document.getElementById("feedBox");
const recordButton = document.getElementById("recordSubmit");
const recordField = document.getElementById("recordID");
const fileCount = document.getElementById("fileCount");
const filesDisplayed = document.getElementById("filesDisplayed");
const recordOptions = document.getElementById("recordOptions");
const searchBar = document.getElementById("searchBar");
const recordType = document.getElementById("recordType");
const deletionOptions = document.getElementById("deleteRecordOptions");
const modeSwitch = document.getElementById("mode-Switch");
const modeLabel = document.getElementById("mode-Label");
const recordApproval = document.getElementById("record-Approval");
const deleteSwitch = document.getElementById("deleteType-Switch");
const deleteTypeLabel = document.getElementById("deleteType-Label");

// Buttons
const changeRecordButton = document.createElement("button");
const deleteRecordButton = document.createElement("button");
const deleteAllRecords = document.createElement("button");
const deleteDisplayed = document.createElement("button");
const deleteAccountButton = document.createElement("button");

// Variables
let saveTimer = null;
let submitTimer = null;
let targetId;
let targetType = recordType.value;
let displayedRecords = [];
let allRecords = [];

// Function to handle clearing the save confirmation message
function clearSaveConfirmation() {
  saveconfirm.textContent = "";
}

// Function to show the save confirmation message and start the hide timer
function showSaveConfirmation(message) {
  saveconfirm.textContent = message;
  clearTimeout(saveTimer); // Clear any existing hide timer
  hideTimer = setTimeout(clearSaveConfirmation, 3000); // Start the hide timer after 3 seconds
}

function clearRecordValidated() {
  recordApproval.textContent = "";
}

function showRecordValidated(message) {
  recordApproval.textContent = message;
  clearTimeout(submitTimer);
  hideTimer = setTimeout(clearRecordValidated, 3000);
}

// Save button click handler
configButton.addEventListener("click", () => {
  const portalValue = portalField.value;
  const keyValue = keyField.value;
  const passValue = passField.value;
  window.api.comm.invoke(CHANNELS.SET_PORTAL, portalValue);
  window.api.comm.invoke(CHANNELS.SET_KEY, keyValue);
  window.api.comm.invoke(CHANNELS.SET_PASS, passValue);

  showSaveConfirmation("Integration Credentials Saved.");
});

// Open file selector button click handler
selectFileButton.addEventListener("click", () => {
  window.api.dialog.openFileSelect().then((file) => {
    console.log(file);
    if (file) {
      selectedFile.textContent = file.fileName;
      deleteAllRecords.id = "deleteAllRecords";
      deleteAllRecords.textContent = "Delete All";
      deletionOptions.appendChild(deleteAllRecords);
    } else {
      deletionOptions.textContent = "";
      console.log("Invalid file");
      selectedFile.textContent = "";
    }
  });
});

// Change and delete record button click handlers
changeRecordButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.CHANGE_RECORD, { targetId, targetType });
});

deleteRecordButton.addEventListener("click", () => {
  if(targetType == 'customers') {
    window.api.comm.invoke(CHANNELS.DELETE_RECORD, targetId);
  } else {
    alert("Invalid record type. Cannot delete.");
  }
});

// Record button click handler
recordButton.addEventListener("click", async () => {
  targetId = recordField.value;
  const result = await window.api.comm.invoke(CHANNELS.SET_RECORD, {
    targetId,
    targetType,
  });

  console.log(result.data);

  console.log(result.status);

  console.log(typeof(result.status));

  switch (result.status) {
    case 200:
      console.log(200);
      showRecordValidated("Valid record detected.");
      changeRecordButton.id = "changeRecordButton";
      changeRecordButton.textContent = "View/Change Record";
      recordOptions.appendChild(changeRecordButton);

      deleteRecordButton.id = "deleteRecordButton";
      deleteRecordButton.textContent = "Delete Record";
      recordOptions.appendChild(deleteRecordButton);
      if (targetType == "customers") {
        deleteAccountButton.id = "deleteAccountButton";
        deleteAccountButton.textContent = "Delete Account";
        recordOptions.append(deleteAccountButton);
      } else {
        console.log("REMOVING DELETE ACCOUNT BUTTON.");
        deleteAccountButton.remove();
      }
      break;
    case 400:
      console.log(400);
      recordOptions.textContent = "";
      showRecordValidated(result.data.Message);
      break;
    case 401:
      console.log(401); 
      recordOptions.textContent = "";
      showRecordValidated(result.data.Message);
      break;
    case 404:
      console.log(404);
      recordOptions.textContent = "";
      showRecordValidated(result.error);
      break;
    case 405:
      console.log(405);
      recordOptions.textContent = "";
      showRecordValidated("Submission failed.");
      alert(result.data.Message);
      break;
    case 500:
      console.log(500);
      recordOptions.textContent = "";
      showRecordValidated("Submission failed.");
      alert(result.error);
      break;
    case undefined:
      console.log(undefined);
      recordOptions.textContent = "";
      showRecordValidated("No record detected.");
      break;
    default:
      console.log("Unknown error");
      recordOptions.textContent = "";
      showRecordValidated("Unknown error. Please try again.");
      break;
  }
});

// Record type change handler
recordType.addEventListener("change", () => {
  targetType = recordType.value;
  console.log(targetType);
});

// Receiving feed box and feed box clear CHANNELS
window.api.comm.receive(CHANNELS.FEED_BOX, (message) => {
  feed.insertAdjacentHTML("beforeend", `<div>${message}</div>`);
});

window.api.comm.receive(CHANNELS.FEED_BOX_CLEAR, () => {
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
  window.api.comm.invoke(CHANNELS.DELETE_ALL);
});

deleteDisplayed.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.DELETE_DISPLAYED, displayedRecords);
});

// Receiving selected file count event
window.api.comm.receive(CHANNELS.SELECTED_FILE_COUNT, (count) => {
    fileCount.textContent = fileCount ? count + " records loaded" : "";
    fileCount.value = count;
});

window.api.comm.receive(CHANNELS.DELETED_FILE_COUNT, (count) => {
  fileCount.textContent = fileCount ? count + " records deleted" : "";
  fileCount.value = count;
});

// Change mode between sandbox and live when switch is clicked
modeSwitch.addEventListener("change", (event) => {
  window.api.comm.invoke(CHANNELS.TOGGLE_MODE, event.target.checked);
  console.log(event.target.checked);
  modeLabel.textContent = event.target.checked ? "Production" : "Sandbox";
});

deleteSwitch.addEventListener("change", (event) => {
  window.api.comm.invoke(CHANNELS.TOGGLE_DELETE);
  console.log(event.target.checked);
  deleteTypeLabel.textContent = event.target.checked ? "Delete Account" : "Delete Customer";
});

deleteAccountButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.DELETE_ACCOUNT);
});

window.api.comm.receive(CHANNELS.CLEAR_DELETE_OPTIONS, (cleared) => {
  console.log("Clearing");
  if (cleared) deletionOptions.textContent = "";
  filesDisplayed.textContent = "";
});