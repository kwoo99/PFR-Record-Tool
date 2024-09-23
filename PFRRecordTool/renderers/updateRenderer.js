const { CHANNELS } = window.api.comm;

const recordBody = document.getElementById("recordBody-label");
const updateButton = document.getElementById("updateButton-label");
const cancelButton = document.getElementById("cancelButton-label");

let recordType;
let submittedId;
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
  const updatedRecordData = JSON.parse(recordBody.value); // Parse the textarea value as JSON

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

  const isNewId = origId == submittedId;
  console.log(origId);
  console.log(submittedId);
  // console.log(recordBody.value);
  // const data = recordBody.textContent;
  const data = recordBody.value;
  window.api.comm.invoke(CHANNELS.CONFIRM_UPDATE, {isNewId, data});
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.UPDATE_CANCEL);
});
