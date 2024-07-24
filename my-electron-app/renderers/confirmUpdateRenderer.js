const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");

confirmButton.addEventListener("click", () => {
    window.api.comm.invoke("update-Confirmed");
});

cancelButton.addEventListener("click", () => {
    window.api.comm.invoke("update-Cancel");
});