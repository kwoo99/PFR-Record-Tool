/**
 * Customer deletion workspace controller.
 * Owns CSV and portal-list selection, activity-feed filtering, displayed-record
 * selection, and Partial/Full delete mode. Actual deletion execution lives in
 * the main process.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const selectFileButton = document.getElementById("selectFileButton");
  const fileCount = document.getElementById("fileCount");
  const filesDisplayed = document.getElementById("filesDisplayed");
  const searchBar = document.getElementById("searchBar");
  const deletionOptions = document.getElementById("deleteRecordOptions");
  const deleteSwitch = document.getElementById("deleteType-Switch");
  const deleteTypeLabel = document.getElementById("deleteType-Label");
  const fetchPortalCustomersButton = document.getElementById(
    "fetchPortalCustomersButton",
  );
  const portalCustomerFetchStatus = document.getElementById(
    "portalCustomerFetchStatus",
  );

  const deleteAllRecordsButton = document.createElement("button");
  const deleteDisplayedButton = document.createElement("button");
  let displayedRecords = [];
  let loadedRecordCount = 0;

  deleteAllRecordsButton.id = "deleteAllRecords";
  deleteAllRecordsButton.textContent = "Delete all loaded";
  deleteDisplayedButton.id = "deleteDisplayed";
  deleteDisplayedButton.textContent = "Delete filtered records";

  function showDeleteAllButton() {
    deletionOptions.textContent = "";
    if (loadedRecordCount > 0) {
      deletionOptions.appendChild(deleteAllRecordsButton);
    }
  }

  // File selection causes the main process to load IDs into the shared feed.
  selectFileButton.addEventListener("click", async () => {
    const file = await window.api.dialog.openFileSelect();
    if (file) {
      searchBar.value = "";
      filesDisplayed.textContent = "";
      showDeleteAllButton();
    }
  });

  // Filtering also defines the record subset used by “Delete filtered records.”
  searchBar.addEventListener("input", () => {
    const searchTerm = searchBar.value.trim();
    const filteredFeed = window.feedWorkspace.filter(searchTerm);
    displayedRecords = filteredFeed.records;
    const displayCount = displayedRecords.length;
    const formattedDisplayCount = new Intl.NumberFormat().format(displayCount);
    const formattedLoadedCount = new Intl.NumberFormat().format(
      loadedRecordCount,
    );
    filesDisplayed.textContent = searchTerm
      ? loadedRecordCount > 0
        ? `Showing ${formattedDisplayCount} of ${formattedLoadedCount}`
        : `${formattedDisplayCount} matching feed entr${displayCount === 1 ? "y" : "ies"}`
      : "";

    deletionOptions.textContent = "";
    if (
      loadedRecordCount > 0 &&
      displayCount !== loadedRecordCount &&
      displayCount > 0
    ) {
      deletionOptions.appendChild(deleteDisplayedButton);
    } else if (loadedRecordCount > 0) {
      deletionOptions.appendChild(deleteAllRecordsButton);
    }
  });

  deleteAllRecordsButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.DELETE_ALL);
  });

  deleteDisplayedButton.addEventListener("click", () => {
    window.api.comm.invoke(CHANNELS.DELETE_DISPLAYED, displayedRecords);
  });

  fetchPortalCustomersButton.addEventListener("click", async () => {
    fetchPortalCustomersButton.disabled = true;
    portalCustomerFetchStatus.dataset.state = "loading";
    portalCustomerFetchStatus.textContent =
      "Fetching customers from the current portal…";

    try {
      const result = await window.api.comm.invoke(
        CHANNELS.FETCH_PORTAL_CUSTOMERS,
      );
      if (result.error) {
        portalCustomerFetchStatus.dataset.state = "error";
        portalCustomerFetchStatus.textContent = result.error;
      } else {
        const formattedCount = new Intl.NumberFormat().format(result.count);
        const customerLabel = result.count === 1 ? "customer" : "customers";
        searchBar.value = "";
        filesDisplayed.textContent = "";
        portalCustomerFetchStatus.dataset.state =
          result.count === 0 ? "empty" : "success";
        portalCustomerFetchStatus.textContent =
          result.count === 0
            ? "No customers were found in this portal."
            : `${formattedCount} ${customerLabel} loaded from the portal.`;
      }
    } catch (error) {
      portalCustomerFetchStatus.dataset.state = "error";
      portalCustomerFetchStatus.textContent =
        "The customer list could not be loaded. Try again.";
    } finally {
      fetchPortalCustomersButton.disabled = false;
    }
  });

  window.api.comm.receive(CHANNELS.SELECTED_FILE_COUNT, (value) => {
    const count = typeof value === "object" ? value.count : value;
    loadedRecordCount = Number(count) || 0;
    fileCount.textContent =
      typeof value === "object"
        ? value.displayText
        : `${loadedRecordCount} record${loadedRecordCount === 1 ? "" : "s"} loaded`;
    showDeleteAllButton();
  });

  deleteSwitch.addEventListener("change", (event) => {
    // Send the actual checkbox state so UI and main-process scope cannot drift.
    window.api.comm.invoke(CHANNELS.TOGGLE_DELETE, event.target.checked);
    deleteTypeLabel.textContent = event.target.checked
      ? "Delete full account"
      : "Delete customer only";
  });

  window.api.comm.receive(CHANNELS.ACTION_RESPONSE, (message) => {
    alert(message);
  });
})();
