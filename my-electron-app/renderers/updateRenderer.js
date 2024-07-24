const recordBody = document.getElementById("recordBody-label");
const updateButton = document.getElementById("updateButton-label");
const cancelButton = document.getElementById("cancelButton-label");

window.onload = function () {
  const recordDetails = window.api.comm.invoke("get-Record-Details");
  recordBody.textContent = recordDetails;
}

updateButton.addEventListener("click", () => {
  window.api.comm.invoke("confirm-Update");
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke("update-Cancel");
});

