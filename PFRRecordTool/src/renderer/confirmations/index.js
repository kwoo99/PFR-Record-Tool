/**
 * Shared confirmation-dialog controller.
 * The page's data-confirm-channel attribute selects which confirmed action runs;
 * every confirmation page uses this one script.
 */
const { CHANNELS } = window.api.comm;

const confirmButton = document.getElementById("confirmButton-label");
const cancelButton = document.getElementById("cancelButton-label");
const confirmChannel = CHANNELS[document.body.dataset.confirmChannel];

const DELETE_CONFIRMATION_COPY = Object.freeze({
  single: {
    Partial: {
      button: "Delete customer",
      description:
        "This deletes the customer record only. Full account deletion is not selected.",
      title: "Delete this customer record?",
    },
    Full: {
      button: "Delete full account",
      description:
        "All account data for this customer will be permanently deleted.",
      title: "Delete this customer’s full account?",
    },
  },
  loaded: {
    Partial: {
      button: "Delete customers",
      description:
        "Only the loaded customer records will be deleted. Full account deletion is not selected.",
      title: "Delete all loaded customer records?",
    },
    Full: {
      button: "Delete full accounts",
      description:
        "All account data for every loaded customer will be permanently deleted.",
      title: "Delete full accounts for all loaded customers?",
    },
  },
  filtered: {
    Partial: {
      button: "Delete customers",
      description:
        "Only the filtered customer records will be deleted. Full account deletion is not selected.",
      title: "Delete the filtered customer records?",
    },
    Full: {
      button: "Delete full accounts",
      description:
        "All account data for every filtered customer will be permanently deleted.",
      title: "Delete full accounts for the filtered customers?",
    },
  },
});

async function showSelectedDeleteScope() {
  const target = document.body.dataset.deleteTarget;
  if (!target) {
    return;
  }

  const deleteType = await window.api.comm.invoke(CHANNELS.GET_DELETE_SCOPE);
  const copy = DELETE_CONFIRMATION_COPY[target][deleteType];
  document.getElementById("deleteConfirm-label").textContent = copy.title;
  document.getElementById("confirmation-description").textContent =
    copy.description;
  confirmButton.textContent = copy.button;
  document.title = copy.title;
}

confirmButton.addEventListener("click", () => {
  window.api.comm.invoke(confirmChannel);
});

cancelButton.addEventListener("click", () => {
  window.api.comm.invoke(CHANNELS.CONFIRMATION_CANCEL);
});

showSelectedDeleteScope();
