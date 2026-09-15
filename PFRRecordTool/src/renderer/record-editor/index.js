/**
 * Raw JSON record-editor controller.
 * Loads the selected record, tracks its original ID, and routes edits through an
 * update or create confirmation. PayFabric payload rules live in client-core.js.
 */
const { CHANNELS } = window.api.comm;

const recordBody = document.getElementById("recordBody-label");
const updateButton = document.getElementById("updateButton-label");
const cancelButton = document.getElementById("cancelButton-label");
const editorStatus = document.getElementById("editorStatus");

let recordType;
let submittedId;
// Retaining the lookup ID lets invoice PATCH requests target the original record.
let origId;

window.onload = async function () {
  const recordDetails = await window.api.comm.invoke(CHANNELS.RECORD_INFO);

  switch (recordDetails.submittedRecordType) {
    case "customers":
      recordType = "customers";
      origId = recordDetails.submittedResponse.data.CustomerId;
      break;
    case "invoices":
      recordType = "invoices";
      origId = recordDetails.submittedResponse.data.InvoiceId;
      break;
    case "payments":
      recordType = "payments";
      origId = recordDetails.submittedResponse.data.PaymentId;
      break;
  }

  const recordData = JSON.stringify(recordDetails.submittedResponse.data, null, 2);
  recordBody.value = recordData;
};

updateButton.addEventListener("click", () => {
  let updatedRecordData;
  try {
    updatedRecordData = JSON.parse(recordBody.value);
  } catch (error) {
    editorStatus.textContent = `The record is not valid JSON: ${error.message}`;
    recordBody.focus();
    return;
  }
  editorStatus.textContent = "";

  switch (recordType) {
    case "customers":
      submittedId = updatedRecordData.CustomerId;
      break;
    case "invoices":
      submittedId = updatedRecordData.InvoiceId;
      break;
    case "payments":
      submittedId = updatedRecordData.PaymentId;
      break;
  }

  // Matching IDs update the existing record; a changed ID uses create confirmation.
  const isNewId = origId == submittedId;
  const data = recordBody.value;
  window.api.comm.invoke(CHANNELS.CONFIRM_UPDATE, { isNewId, data });
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.UPDATE_CANCEL);
});
