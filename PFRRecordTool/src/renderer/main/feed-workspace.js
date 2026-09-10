/**
 * Shared activity-feed presentation.
 * Owns the complete feed dataset, bounded DOM rendering, full-list filtering,
 * and source labels so large inputs remain responsive and searchable.
 */
(() => {
  const { CHANNELS } = window.api.comm;
  const feed = document.getElementById("feedBox");
  const sourceBadge = document.getElementById("feedSourceBadge");
  const sourceDetail = document.getElementById("feedSourceDetail");
  const displaySummary = document.getElementById("feedDisplaySummary");
  const selectedFile = document.getElementById("selectedFile");
  const searchBar = document.getElementById("searchBar");
  const filesDisplayed = document.getElementById("filesDisplayed");
  const portalStatus = document.getElementById("portalCustomerFetchStatus");
  const bulkStatus = document.getElementById("bulkStatus");
  const MAX_VISIBLE_LINES = 500;
  const numberFormatter = new Intl.NumberFormat();

  let entries = [];
  let matchingEntryCount = 0;
  let searchTerm = "";

  function createLine(message) {
    const line = document.createElement("div");
    line.textContent = message;
    return line;
  }

  function matchesSearch(message) {
    return message.toLowerCase().includes(searchTerm);
  }

  function updateDisplaySummary() {
    if (entries.length === 0) {
      displaySummary.textContent = "";
      return;
    }

    const visibleCount = Math.min(matchingEntryCount, MAX_VISIBLE_LINES);
    const formattedVisible = numberFormatter.format(visibleCount);
    const formattedMatches = numberFormatter.format(matchingEntryCount);
    const formattedTotal = numberFormatter.format(entries.length);

    if (searchTerm) {
      displaySummary.textContent =
        matchingEntryCount > MAX_VISIBLE_LINES
          ? `Showing the first ${formattedVisible} of ${formattedMatches} matches across ${formattedTotal} records.`
          : `Showing ${formattedMatches} of ${formattedTotal} records.`;
      return;
    }

    displaySummary.textContent =
      entries.length > MAX_VISIBLE_LINES
        ? `Showing the first ${formattedVisible} of ${formattedTotal} records. Search checks the full list.`
        : `Showing all ${formattedTotal} record${entries.length === 1 ? "" : "s"}.`;
  }

  function renderMatchingEntries() {
    const matchingEntries = searchTerm
      ? entries.filter(matchesSearch)
      : entries;
    matchingEntryCount = matchingEntries.length;
    const fragment = document.createDocumentFragment();
    for (const message of matchingEntries.slice(0, MAX_VISIBLE_LINES)) {
      fragment.appendChild(createLine(message));
    }
    feed.replaceChildren(fragment);
    updateDisplaySummary();
    return {
      records: matchingEntries,
      total: entries.length,
      visible: Math.min(matchingEntryCount, MAX_VISIBLE_LINES),
    };
  }

  function appendText(message) {
    const entry = String(message);
    entries.push(entry);
    if (!matchesSearch(entry)) {
      updateDisplaySummary();
      return;
    }

    matchingEntryCount++;
    if (matchingEntryCount <= MAX_VISIBLE_LINES) {
      feed.appendChild(createLine(entry));
      feed.scrollTop = feed.scrollHeight;
    }
    updateDisplaySummary();
  }

  function appendRecordResult(recordId, message) {
    appendText(`${recordId}: ${message}`);
  }

  function replaceRecords(records) {
    entries = records.map(String);
    return renderMatchingEntries();
  }

  function filter(term) {
    searchTerm = term.trim().toLowerCase();
    return renderMatchingEntries();
  }

  function clear() {
    entries = [];
    matchingEntryCount = 0;
    feed.replaceChildren();
    displaySummary.textContent = "";
  }

  function showSource(source) {
    sourceBadge.textContent = source.label;
    sourceBadge.dataset.source = source.label.toLowerCase().replaceAll(" ", "-");
    sourceDetail.textContent = source.detail;
    selectedFile.textContent = source.selectionLabel;
    searchBar.value = "";
    searchTerm = "";
    filesDisplayed.textContent = "";
    bulkStatus.textContent = "";

    if (source.label !== "Portal") {
      portalStatus.textContent = "";
      delete portalStatus.dataset.state;
    }
  }

  window.feedWorkspace = Object.freeze({ appendRecordResult, filter });
  window.api.comm.receive(CHANNELS.FEED_BOX, appendText);
  window.api.comm.receive(CHANNELS.FEED_BOX_CLEAR, clear);
  window.api.comm.receive(CHANNELS.FEED_RECORDS_REPLACE, replaceRecords);
  window.api.comm.receive(CHANNELS.FEED_SOURCE, showSource);
})();
