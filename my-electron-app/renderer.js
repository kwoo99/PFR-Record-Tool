const { readCSVFile } = require('./csvParser.cjs');

const information = document.getElementById("info");
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;

// Objects defined to link html ids with defined functionality below
const keyField = document.getElementById("intKey");
const passField = document.getElementById("intPass");
const intButton = document.getElementById("intButton");
const saveconfirm = document.getElementById("save-confirmation");
const selectFileName = document.getElementById("selectedFileName");

let fadeOutTimer = null; // Track the timer ID for the fade-out animation

// All actions taken when the Save button is pressed
intButton.addEventListener("click", () => {
  const keyValue = keyField.value;
  const passValue = passField.value;
  window.int.setKey(keyValue);
  window.int.setPass(passValue);
  window.int.send("button-clicked");

//Will open file selector when button is pressed (work in progress)
document.getElementById("selectFileButton").addEventListener("click", () => {
    // Open file dialog
    dialog.showOpenDialog({ properties: ['openFile'] }).then(async function (response) {
        if (!response.canceled) {
        const filePath = response.filePaths[0];
        selectedFileName.textContent = path.basename(filePath); // Display only the file name
        } else {
        console.log("No file selected");
        selectedFileName.textContent = ''; // Clear selected file name if canceled
        }
    });
});

  // Clear any existing fade-out timer
  clearTimeout(fadeOutTimer);

  // If the message is already visible, start the fade-out timer immediately
  if (saveconfirm.style.opacity === "1") {
    startFadeOutTimer();
  }
});

// Receives message returned when index,js receives signal on saveconfirm channel
window.int.receive("saveconfirm", (message) => {
  saveconfirm.textContent = message;

  // Ensure the message is fully visible
  saveconfirm.style.opacity = 1;

  // Clear any existing fade-out timer
  clearTimeout(fadeOutTimer);

  // Start the fade-out timer after 5 seconds
  startFadeOutTimer();
});

function startFadeOutTimer() {
  fadeOutTimer = setTimeout(() => {
    fadeOut(saveconfirm);
  }, 1000);
}

function fadeOut(element) {
  var opacity = 1;
  var timerId = setInterval(function () {
    if (opacity <= 0) {
      clearInterval(timerId);
      element.classList.add("fade-out");
    } else {
      opacity -= 0.05;
      element.style.opacity = opacity;
    }
  }, 100); // run every 0.1 second
}
