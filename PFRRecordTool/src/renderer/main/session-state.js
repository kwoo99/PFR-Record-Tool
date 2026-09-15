/**
 * Records-page session snapshot.
 * Captures entered fields, loaded feed data, and controller state immediately
 * before navigating to AutoPay, then reconstructs them on return.
 */
(() => {
  const sessionTools = window.workspaceSession;
  const controlIds = [
    "mode-Switch",
    "portalName",
    "intKey",
    "intPass",
    "recordID",
    "recordType",
    "searchBar",
    "deleteType-Switch",
    "bulkRecordInput",
    "bulkRecordType",
  ];
  const presentationIds = [
    "save-confirmation",
    "record-Approval",
    "portalCustomerFetchStatus",
    "bulkStatus",
    "fileCount",
    "filesDisplayed",
  ];

  function capture() {
    return {
      controls: sessionTools.captureControls(document, controlIds),
      deletion: window.recordsDeletionWorkspace.captureState(),
      feed: window.feedWorkspace.captureState(),
      presentation: sessionTools.capturePresentation(
        document,
        presentationIds,
      ),
      singleRecord: window.singleRecordWorkspace.captureState(),
    };
  }

  function restore(snapshot) {
    sessionTools.restoreControls(document, snapshot.controls);
    window.feedWorkspace.restoreState(snapshot.feed);
    window.recordsDeletionWorkspace.restoreState(snapshot.deletion);
    window.singleRecordWorkspace.restoreState(snapshot.singleRecord);
    sessionTools.restorePresentation(document, snapshot.presentation);

    document.getElementById("mode-Label").textContent = document.getElementById(
      "mode-Switch",
    ).checked
      ? "Production"
      : "Sandbox";
    document.getElementById("deleteType-Label").textContent = document.getElementById(
      "deleteType-Switch",
    ).checked
      ? "Delete Full Account"
      : "Delete Customer Only";
  }

  const session = sessionTools.createWorkspaceSession({
    capture,
    comm: window.api.comm,
    links: document.querySelectorAll("[data-workspace-link]"),
    location: window.location,
    restore,
    workspace: "records",
  });
  session.start().catch(() => {});
})();
