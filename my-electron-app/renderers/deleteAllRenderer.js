const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");

confirmButton.addEventListener("click", () => {
    window.api.comm.invoke("DELETE-ALL-CONFIRM");
});

cancelButton.addEventListener("click", () => {
    window.api.comm.invoke("CONFIRMATION-CANCEL");
});

