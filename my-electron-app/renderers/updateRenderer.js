const recordBody = document.getElementById("recordBody-label");
const updateButton = document.getElementById("updateButton-label");
const cancelButton = document.getElementById("cancelButton-label");

window.onload = async function () {
  const recordDetails = await window.api.comm.invoke("GET-RECORD-DETAILS");
  console.log(recordDetails);
  // recordBody.textContent = JSON.stringify(recordDetails, null, 2);
  recordBody.textContent = recordDetails;
}

updateButton.addEventListener("click", () => {
  window.api.comm.invoke("CONFIRM-UPDATE");
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke("UPDATE-CANCEL");
});

