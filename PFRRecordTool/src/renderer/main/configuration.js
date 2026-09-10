/**
 * Portal-connection controller for the main screen.
 * Owns credential submission, Sandbox/Production selection, and save feedback.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const information = document.getElementById("info");
  const portalField = document.getElementById("portalName");
  const keyField = document.getElementById("intKey");
  const passField = document.getElementById("intPass");
  const configButton = document.getElementById("configButton");
  const saveConfirmation = document.getElementById("save-confirmation");
  const modeSwitch = document.getElementById("mode-Switch");
  const modeLabel = document.getElementById("mode-Label");

  let saveTimer;

  information.innerText = `This app is using Chrome (v${window.api.versions.chrome()}), Node.js (v${window.api.versions.node()}), and Electron (v${window.api.versions.electron()})`;

  function showSaveConfirmation(message) {
    saveConfirmation.textContent = message;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveConfirmation.textContent = "";
    }, 3000);
  }

  configButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.SET_PORTAL, portalField.value);
    window.api.comm.invoke(CHANNELS.SET_KEY, keyField.value);
    window.api.comm.invoke(CHANNELS.SET_PASS, passField.value);
    showSaveConfirmation("Integration Credentials Saved.");
  });

  modeSwitch.addEventListener("change", (event) => {
    window.api.comm.invoke(CHANNELS.TOGGLE_MODE, event.target.checked);
    modeLabel.textContent = event.target.checked ? "Production" : "Sandbox";
  });
})();
