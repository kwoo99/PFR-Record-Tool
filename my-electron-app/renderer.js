const information = document.getElementById("info");
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;

// Objects defined to link HTML ids with defined functionality below
const portalField = document.getElementById("portalname");
const keyField = document.getElementById("intKey");
const passField = document.getElementById("intPass");
const configButton = document.getElementById("configButton");
const saveconfirm = document.getElementById("save-confirmation");
const selectFileButton = document.getElementById("selectFileButton");
const selectedFileName = document.getElementById("selectedFile");
const feed = document.getElementById("feedBox");
const recordButton = document.getElementById("submitButton");
const recordField = document.getElementById("recordID");

// const feedBase = document.getElementById("feedBase");

let hideTimer = null; // Track the timer ID for clearing the message

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
  window.config.setPortal(portalValue);
  window.config.setKey(keyValue);
  window.config.setPass(passValue);
  window.config.send("button-clicked");

  showSaveConfirmation("Integration Credentials Saved.");
});

// Open file selector when the button is pressed
selectFileButton.addEventListener("click", () => {
  window.dialog.openFileSelect().then((file) => {
    const fileInstance = document.createElement("h5");
    fileInstance.id = "selectedFileName";
    if (file) {
      console.log(file);
      selectedFileName.textContent = "";
      fileInstance.textContent = file.fileName;
      selectedFileName.appendChild(fileInstance);
      // selectedFileName.textContent = file.fileName;
    } else {
      console.log("No file selected");
      selectedFileName.textContent = "";
      // Optionally handle case where no file is selected
    }
  });
});

recordButton.addEventListener("click", () => {
  const customerValue = customerField.value;
  window.customer.setRecord(customerValue);
});

// Receives message returned when index.js receives signal on saveconfirm channel
window.config.receive("saveconfirm", (message) => {
  showSaveConfirmation(message);
});

// Receives record ids from index.js and then displays them into the feed box
window.config.receive("feedBox", (message) => {
  feed.insertAdjacentHTML('beforeend', `<div>${message}</div>`);
});

// Clears the feed box before every new file load instance when signal is received from index.js
window.config.receive("feedBoxClear", () => {
  feed.textContent = "";
});