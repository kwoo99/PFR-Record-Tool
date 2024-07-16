const information = document.getElementById("info");
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;

// Objects defined to link HTML ids with defined functionality below
const keyField = document.getElementById("intKey");
const passField = document.getElementById("intPass");
const intButton = document.getElementById("intButton");
const saveconfirm = document.getElementById("save-confirmation");
const selectFileButton = document.getElementById("selectFileButton");
const selectedFileName = document.getElementById("selectedFileName");
const feed = document.getElementById("feedBox");

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
intButton.addEventListener("click", () => {
  const keyValue = keyField.value;
  const passValue = passField.value;
  window.int.setKey(keyValue);
  window.int.setPass(passValue);
  window.int.send("button-clicked");

  // Show the save confirmation message immediately
  showSaveConfirmation("Integration Credentials Saved.");
});

// Receives message returned when index.js receives signal on saveconfirm channel
window.int.receive("saveconfirm", (message) => {
  // Show the save confirmation message immediately
  showSaveConfirmation(message);
});

// Open file selector when the button is pressed
selectFileButton.addEventListener("click", () => {
  window.dialog.openFileSelect().then((file) => {
    if (file) {
      console.log(file);
      selectedFileName.textContent = file.fileName;
    } else {
      console.log("No file selected");
      selectedFileName.textContent = "";
      // Optionally handle case where no file is selected
    }
  });
});
