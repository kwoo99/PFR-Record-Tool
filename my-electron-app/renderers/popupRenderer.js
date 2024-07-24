const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");

confirmButton.addEventListener("click", () => {
    window.api.comm.invoke("confirmed");
});

cancelButton.addEventListener("click", () => {
    window.api.comm.invoke("canceled");
});