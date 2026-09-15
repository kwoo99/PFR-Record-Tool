/**
 * Session navigation bridge shared by the Records and AutoPay pages.
 * Snapshots live only in the Electron main process, so normal page switches
 * retain work while closing the application clears it.
 */
(function initializeWorkspaceSession(root) {
  function captureControls(documentObject, ids) {
    return Object.fromEntries(
      ids.flatMap((id) => {
        const element = documentObject.getElementById(id);
        if (!element) return [];
        return [
          [
            id,
            {
              checked: Boolean(element.checked),
              value: element.value,
            },
          ],
        ];
      }),
    );
  }

  function restoreControls(documentObject, controls = {}) {
    for (const [id, saved] of Object.entries(controls)) {
      const element = documentObject.getElementById(id);
      if (!element) continue;
      if (typeof saved.value === "string") element.value = saved.value;
      if (typeof saved.checked === "boolean") element.checked = saved.checked;
    }
  }

  function capturePresentation(documentObject, ids) {
    return Object.fromEntries(
      ids.flatMap((id) => {
        const element = documentObject.getElementById(id);
        if (!element) return [];
        return [
          [
            id,
            {
              state: element.dataset?.state,
              text: element.textContent,
            },
          ],
        ];
      }),
    );
  }

  function restorePresentation(documentObject, presentation = {}) {
    for (const [id, saved] of Object.entries(presentation)) {
      const element = documentObject.getElementById(id);
      if (!element) continue;
      element.textContent = saved.text ?? "";
      if (saved.state) element.dataset.state = saved.state;
      else delete element.dataset.state;
    }
  }

  function createWorkspaceSession({
    capture,
    comm,
    links,
    location,
    restore,
    workspace,
  }) {
    const { CHANNELS } = comm;
    let restorePromise = Promise.resolve();
    let navigationBound = false;

    async function save() {
      return comm.invoke(CHANNELS.SET_WORKSPACE_STATE, {
        snapshot: capture(),
        workspace,
      });
    }

    function bindNavigation() {
      if (navigationBound) return;
      navigationBound = true;
      for (const link of links) {
        link.addEventListener("click", async (event) => {
          event.preventDefault();
          try {
            await restorePromise;
            await save();
          } finally {
            location.assign(link.href);
          }
        });
      }
    }

    function start() {
      bindNavigation();
      restorePromise = comm
        .invoke(CHANNELS.GET_WORKSPACE_STATE, workspace)
        .then((snapshot) => {
          if (snapshot) restore(snapshot);
          return snapshot;
        });
      return restorePromise;
    }

    return { save, start };
  }

  const publicAPI = {
    captureControls,
    capturePresentation,
    createWorkspaceSession,
    restoreControls,
    restorePresentation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicAPI;
  } else {
    root.workspaceSession = publicAPI;
  }
})(typeof window === "undefined" ? globalThis : window);
