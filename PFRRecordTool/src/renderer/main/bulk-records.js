/**
 * Semicolon-separated bulk-record controller.
 * Owns parsing pasted IDs and the Fetch, Delete, and View/Change actions. Bulk
 * deletion execution and progress state remain in the deletion modules.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const bulkInput = document.getElementById("bulkRecordInput");
  const bulkRecordType = document.getElementById("bulkRecordType");
  const bulkFetchButton = document.getElementById("bulkFetchButton");
  const bulkDeleteButton = document.getElementById("bulkDeleteButton");
  const bulkChangeButton = document.getElementById("bulkChangeButton");
  const bulkStatus = document.getElementById("bulkStatus");

  function parseBulkIds() {
    return bulkInput.value
      .split(";")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  function feedBulkResult(id, message) {
    window.feedWorkspace.appendRecordResult(id, message);
  }

  async function activateTextList(ids) {
    await window.api.comm.invoke(CHANNELS.ACTIVATE_TEXT_LIST, {
      count: ids.length,
    });
  }

  // Fetch reports availability only; it does not open editor windows.
  bulkFetchButton.addEventListener("click", async () => {
    const ids = parseBulkIds();
    if (ids.length === 0) {
      bulkStatus.textContent = "Enter at least one record ID.";
      return;
    }

    await activateTextList(ids);
    const type = bulkRecordType.value;
    bulkStatus.textContent = `Fetching ${ids.length} record${ids.length === 1 ? "" : "s"}…`;
    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
      const result = await window.api.comm.invoke(CHANNELS.SET_RECORD, {
        targetId: id,
        targetType: type,
      });

      switch (result.status) {
        case 200:
          feedBulkResult(id, "Found.");
          succeeded++;
          break;
        case 400:
        case 401:
          feedBulkResult(
            id,
            `Error: ${result.data?.Message ?? "Bad request."}`,
          );
          failed++;
          break;
        case 404:
          feedBulkResult(id, `Not found: ${result.error}`);
          failed++;
          break;
        case 500:
          feedBulkResult(id, `Server error: ${result.error}`);
          failed++;
          break;
        default:
          feedBulkResult(id, `Unknown response (status ${result.status}).`);
          failed++;
          break;
      }
    }

    bulkStatus.textContent = `${succeeded} found, ${failed} failed.`;
  });

  // Deletion is delegated to the bounded main-process deletion manager.
  bulkDeleteButton.addEventListener("click", async () => {
    const ids = parseBulkIds();
    if (ids.length === 0) {
      bulkStatus.textContent = "Enter at least one record ID.";
      return;
    }

    if (bulkRecordType.value !== "customers") {
      bulkStatus.textContent = "Bulk deletion is available for customers only.";
      return;
    }

    await activateTextList(ids);
    bulkStatus.textContent = "Deletion started. Track progress below.";
    try {
      await window.api.comm.invoke(CHANNELS.BULK_DELETE_RECORD, { ids });
    } catch (error) {
      bulkStatus.textContent = error.message;
    }
  });

  // View/change is intentionally single-record; bulk updates are not supported.
  bulkChangeButton.addEventListener("click", async () => {
    const ids = parseBulkIds();
    if (ids.length === 0) {
      bulkStatus.textContent = "Enter at least one record ID.";
      return;
    }

    await activateTextList(ids);
    const id = ids[0];
    const type = bulkRecordType.value;
    bulkStatus.textContent = `Opening the first ID: ${id}…`;
    const fetchResult = await window.api.comm.invoke(CHANNELS.SET_RECORD, {
      targetId: id,
      targetType: type,
    });

    if (fetchResult.status !== 200) {
      feedBulkResult(id, "Could not open — not found or unavailable.");
      bulkStatus.textContent = `The first ID (${id}) could not be opened.`;
      return;
    }

    await window.api.comm.invoke(CHANNELS.CHANGE_RECORD, {
      targetId: id,
      targetType: type,
    });
    bulkStatus.textContent = `Opened the first ID: ${id}.`;
  });
})();
