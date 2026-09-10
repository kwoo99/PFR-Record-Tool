/**
 * Raw JSON record-editor controller.
 * Loads the selected record, tracks its original ID, and routes edits through an
 * update or create confirmation. PayFabric payload rules live in client-core.js.
 */
const { CHANNELS } = window.api.comm;

const recordBody = document.getElementById("recordBody-label");
const updateButton = document.getElementById("updateButton-label");
const cancelButton = document.getElementById("cancelButton-label");

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

  console.log(recordDetails);
  const recordData = JSON.stringify(recordDetails.submittedResponse.data, null, 2);
  recordBody.value = recordData;
  console.log("RECORD ID: " + origId);
};

updateButton.addEventListener("click", () => {
  const updatedRecordData = JSON.parse(recordBody.value);

  switch (recordType) {
    case "customers":
      console.log("Customer");
      submittedId = updatedRecordData.CustomerId;
      break;
    case "invoices":
      console.log("Invoice");
      submittedId = updatedRecordData.InvoiceId;
      break;
    case "payments":
      console.log("Payment");
      submittedId = updatedRecordData.PaymentId;
      break;
  }

  // Matching IDs update the existing record; a changed ID uses create confirmation.
  const isNewId = origId == submittedId;
  console.log(origId);
  console.log(submittedId);
  const data = recordBody.value;
  window.api.comm.invoke(CHANNELS.CONFIRM_UPDATE, { isNewId, data });
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.UPDATE_CANCEL);
});
