/**
 * Single-record lookup controller.
 * Owns record validation feedback and the View/Change, Delete Record, and Delete
 * Account actions shown after a successful lookup.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const recordButton = document.getElementById("recordSubmit");
  const recordField = document.getElementById("recordID");
  const recordOptions = document.getElementById("recordOptions");
  const recordType = document.getElementById("recordType");
  const recordApproval = document.getElementById("record-Approval");

  const changeRecordButton = document.createElement("button");
  const deleteRecordButton = document.createElement("button");
  const deleteAccountButton = document.createElement("button");

  let approvalTimer;
  let targetId;
  let targetType = recordType.value;

  function showRecordValidation(message) {
    recordApproval.textContent = message;
    clearTimeout(approvalTimer);
    approvalTimer = setTimeout(() => {
      recordApproval.textContent = "";
    }, 3000);
  }

  // Build the actions permitted for the currently selected record type.
  function showRecordActions() {
    changeRecordButton.id = "changeRecordButton";
    changeRecordButton.textContent = "View/Change Record";
    recordOptions.appendChild(changeRecordButton);

    deleteRecordButton.id = "deleteRecordButton";
    deleteRecordButton.textContent = "Delete Record";
    recordOptions.appendChild(deleteRecordButton);

    if (targetType === "customers") {
      deleteAccountButton.id = "deleteAccountButton";
      deleteAccountButton.textContent = "Delete Account";
      recordOptions.appendChild(deleteAccountButton);
    } else {
      deleteAccountButton.remove();
    }
  }

  changeRecordButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.CHANGE_RECORD, { targetId, targetType });
  });

  deleteRecordButton.addEventListener("click", () => {
    if (targetType === "customers") {
      window.api.comm.invoke(CHANNELS.DELETE_RECORD, targetId);
    } else {
      alert("Invalid record type. Cannot delete.");
    }
  });

  deleteAccountButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.DELETE_ACCOUNT);
  });

  // Lookup responses control both validation copy and available actions.
  recordButton.addEventListener("click", async () => {
    targetId = recordField.value;
    const result = await window.api.comm.invoke(CHANNELS.SET_RECORD, {
      targetId,
      targetType,
    });

    switch (result.status) {
      case 200:
        showRecordValidation("Valid record detected.");
        showRecordActions();
        break;
      case 400:
      case 401:
        recordOptions.textContent = "";
        showRecordValidation(result.data.Message);
        break;
      case 404:
        recordOptions.textContent = "";
        showRecordValidation(result.error);
        break;
      case 405:
        recordOptions.textContent = "";
        showRecordValidation("Submission failed.");
        alert(result.data.Message);
        break;
      case 500:
        recordOptions.textContent = "";
        showRecordValidation("Submission failed.");
        alert(result.error);
        break;
      case undefined:
        recordOptions.textContent = "";
        showRecordValidation("No record detected.");
        break;
      default:
        recordOptions.textContent = "";
        showRecordValidation("Unknown error. Please try again.");
        break;
    }
  });

  recordType.addEventListener("change", () => {
    targetType = recordType.value;
  });
})();
