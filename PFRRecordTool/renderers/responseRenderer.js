const {CHANNELS} = window.api.comm;

const okButton = document.getElementById("okButton-label");

okButton.addEventListener("click", () => {
    console.log("OK BUTTON PRESSED.");
    window.api.comm.invoke("CLOSE");
});
