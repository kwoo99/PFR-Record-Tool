/**
 * Shared AutoPay renderer state and small presentation helpers.
 * Feature controllers attach narrow callbacks here instead of reaching into one
 * another's private variables.
 */
(() => {
  const { CHANNELS } = window.api.comm;
  const state = {
    connection: null,
    customers: [],
    selectedCustomerIds: new Set(),
    templates: [],
    workbook: null,
  };

  function setStatus(element, message, kind = "success") {
    element.textContent = message;
    element.dataset.state = kind;
  }

  function formatMoney(value, currencyCode) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        currency: currencyCode || "USD",
        style: "currency",
      }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  }

  function isoFromDateInput(value) {
    return window.autoPayScheduleTiming.portalMidnightValue(value);
  }

  function dateInputValue(value) {
    return window.autoPayScheduleTiming.dateInputValue(value);
  }

  const workspace = {
    CHANNELS,
    dateInputValue,
    formatMoney,
    isoFromDateInput,
    onCustomersChanged: () => {},
    onSelectionChanged: () => {},
    openContract: () => {},
    refreshBulkSchedulePreview: () => {},
    refreshContractSchedulePreview: () => {},
    setStatus,
    state,
  };
  window.autoPayWorkspace = workspace;

  async function loadConnectionSummary() {
    const environmentBadge = document.getElementById("environmentBadge");
    const portalSummary = document.getElementById("portalSummary");
    const timezoneSummary = document.getElementById("timezoneSummary");
    const connectionNotice = document.getElementById("connectionNotice");
    const fetchButton = document.getElementById("fetchCustomersButton");
    const connection = await window.api.comm.invoke(
      CHANNELS.GET_CONNECTION_STATUS,
    );
    state.connection = connection;
    environmentBadge.textContent = connection.environment;
    environmentBadge.classList.toggle(
      "is-production",
      connection.environment === "Production",
    );
    portalSummary.textContent = connection.configured
      ? connection.portalName
      : "No Portal Connected";
    const timezoneName = window.autoPayScheduleTiming.formatTimezone(
      connection.timezone,
    );
    timezoneSummary.textContent = connection.configured
      ? `Time Zone: ${timezoneName || "Unavailable"}`
      : "Time Zone: No Portal Connected";
    connectionNotice.hidden = connection.configured;
    fetchButton.disabled = !connection.configured;
    workspace.refreshBulkSchedulePreview();
    workspace.refreshContractSchedulePreview();
  }

  loadConnectionSummary().catch((error) => {
    document.getElementById("portalSummary").textContent = error.message;
    document.getElementById("timezoneSummary").textContent =
      "Time Zone: Unavailable";
  });
})();
