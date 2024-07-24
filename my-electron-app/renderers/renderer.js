const information = document.getElementById("info");
information.innerText = `This app is using Chrome (v${api.versions.chrome()}), Node.js (v${api.versions.node()}), and Electron (v${api.versions.electron()})`;

// Objects defined to link HTML ids with defined functionality below

//Main Window Objects
const portalField = document.getElementById("portalName");
const keyField = document.getElementById("intKey");
const passField = document.getElementById("intPass");
const configButton = document.getElementById("configButton");
const saveconfirm = document.getElementById("save-confirmation");
const selectFileButton = document.getElementById("selectFileButton");
const selectedFileName = document.getElementById("selectedFile");
const feed = document.getElementById("feedBox");
const recordButton = document.getElementById("submitButton");
const recordField = document.getElementById("recordID");
const fileCount = document.getElementById("fileCount");
const recordOptions = document.getElementById("recordOptions");

// const viewRecordButton = document.createElement("button");
const changeRecordButton = document.createElement("button");
const deleteRecordButton = document.createElement("button");

let hideTimer = null; // Track the timer ID for clearing the message
let targetedRecordId

// Function to handle clearing the save confirmation message
function clearSaveConfirmation() {
  saveconfirm.textContent = "";
}

// Function to show the save confirmation message and start the hide timer
function showSaveConfirmation(message) {
  saveconfirm.textContent = message;

  // Clear any existing hide timer
  clearTimeout(hideTimer);

  // Start the hide timer after 3 seconds
  hideTimer = setTimeout(() => {
    clearSaveConfirmation();
  }, 3000);
}

// All actions taken when the Save button is pressed
configButton.addEventListener("click", () => {
  const portalValue = portalField.value;
  const keyValue = keyField.value;
  const passValue = passField.value;
  window.api.comm.invoke("portal-Name", portalValue);
  window.api.comm.invoke("integration-Key", keyValue);
  window.api.comm.invoke("integration-Pass", passValue);

  showSaveConfirmation("Integration Credentials Saved.");
});

// Open file selector when the button is pressed
selectFileButton.addEventListener("click", () => {
  window.api.dialog.openFileSelect().then((file) => {
    // const fileInstance = document.createElement("h5");
    // fileInstance.id = "selectedFileName";
    if (file) {
      console.log(file);
      selectedFile.textContent = "";
      selectedFile.textContent = file.fileName;
      // selectedFileName.appendChild(fileInstance);
      // selectedFileName.textContent = file.fileName;
    } else {
      console.log("No file selected");
      selectedFile.textContent = "";
      // Optionally handle case where no file is selected
    }
  });
});

window.api.comm.receive("record-Retrieval", (message) => {
  if (message) {
    // viewRecordButton.id = "viewRecordButton";
    // viewRecordButton.textContent = "View Record";
    // recordOptions.appendChild(view_change_RecordButton);

    changeRecordButton.id = "changeRecordButton";
    changeRecordButton.textContent = "View/Change Record";
    recordOptions.appendChild(changeRecordButton);

    deleteRecordButton.id = "deleteRecordButton";
    deleteRecordButton.textContent = "Delete Record";
    recordOptions.appendChild(deleteRecordButton);

  }
  else {
    recordOptions.textContent = "";
  }
});

// viewRecordButton.addEventListener("click", () => {
//   window.api.comm.invoke("view-Record-Button");
// });

changeRecordButton.addEventListener("click", async () => {
  window.api.comm.invoke("change-Record-Button", targetedRecordId);
});

deleteRecordButton.addEventListener("click", () => {
  window.api.comm.invoke("delete-Record-Button", targetedRecordId );
});

recordButton.addEventListener("click", () => {
  const recordValue = recordField.value;
  targetedRecordId = recordValue;
  window.api.comm.invoke("record", recordValue);
});

// Receives record ids from index.js and then displays them into the feed box
window.api.comm.receive("feed-Box", (message) => {
  feed.insertAdjacentHTML('beforeend', `<div>${message}</div>`);
});

// Clears the feed box before every new file load instance when signal is received from index.js
window.api.comm.receive("feed-Box-Clear", () => {
  feed.textContent = "";
});

// window.api.comm.receive("error", () => {
//   create
// });

document.getElementById('searchBar').addEventListener('input', function() {
  const searchTerm = document.getElementById('searchBar').value.toLowerCase();
  const feedBox = document.getElementById('feedBox');
  const feedItems = feedBox.getElementsByTagName('div');

  Array.from(feedItems).forEach(item => {
    if (item.textContent.toLowerCase().includes(searchTerm)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
});

window.api.comm.receive("record-Count", (value) => {
  fileCount.textContent = "";
  fileCount.textContent = value;
});