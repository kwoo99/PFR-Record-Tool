const {CHANNELS} = window.api.comm;

const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");

confirmButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.UPDATE_CONFIRM);
});

cancelButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.CONFIRMATION_CANCEL);
});