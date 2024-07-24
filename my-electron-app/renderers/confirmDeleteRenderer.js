const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");

confirmButton.addEventListener("click", () => {
    window.api.comm.invoke("delete-Confirmed");
});

cancelButton.addEventListener("click", () => {
    window.api.comm.invoke("delete-Cancel");
});