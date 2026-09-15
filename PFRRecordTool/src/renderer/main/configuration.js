/**
 * Portal-connection controller for the main screen.
 * Owns credential submission, Sandbox/Production selection, and save feedback.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const portalField = document.getElementById("portalName");
  const keyField = document.getElementById("intKey");
  const passField = document.getElementById("intPass");
  const configButton = document.getElementById("configButton");
  const saveConfirmation = document.getElementById("save-confirmation");
  const modeSwitch = document.getElementById("mode-Switch");
  const modeLabel = document.getElementById("mode-Label");
  const portalSummary = document.getElementById("portalSummary");
  const timezoneSummary = document.getElementById("timezoneSummary");

  let saveTimer;

  function timezoneName(timezone) {
    if (typeof timezone === "string") return timezone.trim();
    return [
      timezone?.displayName,
      timezone?.DisplayName,
      timezone?.name,
      timezone?.Name,
    ].find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
  }

  async function renderConnectionSummary() {
    try {
      const connection = await window.api.comm.invoke(
        CHANNELS.GET_CONNECTION_STATUS,
      );
      portalSummary.textContent = connection.configured
        ? connection.portalName
        : "No Portal Connected";
      const timezone = timezoneName(connection.timezone);
      timezoneSummary.textContent = connection.configured
        ? `Time Zone: ${timezone || "Unavailable"}`
        : "Time Zone: No Portal Connected";
    } catch {
      portalSummary.textContent = "Connection Status Unavailable";
      timezoneSummary.textContent = "Time Zone: Unavailable";
    }
  }

  function showSaveConfirmation(message) {
    saveConfirmation.textContent = message;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveConfirmation.textContent = "";
    }, 3000);
  }

  configButton.addEventListener("click", async () => {
    configButton.disabled = true;
    try {
      await window.api.comm.invoke(CHANNELS.SET_CONFIGURATION, {
        integrationKey: keyField.value,
        integrationPass: passField.value,
        portalName: portalField.value,
      });
      await renderConnectionSummary();
      showSaveConfirmation("Integration credentials saved.");
    } catch (error) {
      showSaveConfirmation(`Could not save connection: ${error.message}`);
    } finally {
      configButton.disabled = false;
    }
  });

  modeSwitch.addEventListener("change", async (event) => {
    modeLabel.textContent = event.target.checked ? "Production" : "Sandbox";
    try {
      await window.api.comm.invoke(CHANNELS.TOGGLE_MODE, event.target.checked);
      await renderConnectionSummary();
    } catch (error) {
      showSaveConfirmation(`Could not change environment: ${error.message}`);
    }
  });

  renderConnectionSummary();
})();
