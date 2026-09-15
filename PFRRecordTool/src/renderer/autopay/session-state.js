/**
 * AutoPay-page session snapshot.
 * Keeps filters, customer results, selections, action inputs, contract-editor
 * state, and recent outcomes intact while the user visits Records.
 */
(() => {
  const workspace = window.autoPayWorkspace;
  const sessionTools = window.workspaceSession;
  const { state } = workspace;
  const controlIds = [
    "customerIdFilter",
    "nameFilter",
    "emailFilter",
    "currencyFilter",
    "autoPayStatusFilter",
    "invoiceBalanceMinFilter",
    "invoiceBalanceMaxFilter",
    "pastDueBalanceMinFilter",
    "pastDueBalanceMaxFilter",
    "creditBalanceMinFilter",
    "creditBalanceMaxFilter",
    "activeUsersMinFilter",
    "activeUsersMaxFilter",
    "nextAutoPayMinFilter",
    "nextAutoPayMaxFilter",
    "customerSearch",
    "selectAllCustomers",
    "contractSource",
    "configurationJson",
    "bulkNextPaymentDate",
    "bulkFixedAmount",
    "bulkPaymentMethod",
    "contractAmountOption",
    "contractFrequency",
    "contractNextPaymentDate",
    "contractPaymentMethod",
    "contractCurrency",
    "contractFixedAmount",
    "contractFrequencyInterval",
    "contractPaymentDay",
    "contractDescription",
    "contractInvoiceTypes",
    "contractApplyCredits",
  ];
  const presentationIds = [
    "customerLoadStatus",
    "customerCount",
    "selectedCount",
    "bulkActionStatus",
    "workbookSummary",
    "contractStatus",
  ];
  function capture() {
    return {
      contractEditor: workspace.captureContractEditor(),
      controls: sessionTools.captureControls(document, controlIds),
      customers: state.customers,
      presentation: sessionTools.capturePresentation(
        document,
        presentationIds,
      ),
      selectedCustomerIds: [...state.selectedCustomerIds],
      selectedTemplateGuid: document.getElementById("templateSelect").value,
      templates: state.templates,
      workbook: state.workbook,
    };
  }

  function restore(snapshot) {
    state.customers = Array.isArray(snapshot.customers)
      ? snapshot.customers
      : [];
    state.selectedCustomerIds = new Set(snapshot.selectedCustomerIds || []);
    state.templates = Array.isArray(snapshot.templates) ? snapshot.templates : [];
    state.workbook = snapshot.workbook || null;

    sessionTools.restoreControls(document, snapshot.controls);
    workspace.renderTemplates(snapshot.selectedTemplateGuid);
    workspace.refreshBulkSource();
    workspace.restoreCustomerWorkspace();
    workspace.restoreContractEditor(snapshot.contractEditor);
    workspace.refreshBulkSchedulePreview();
    workspace.refreshContractSchedulePreview();
    sessionTools.restorePresentation(document, snapshot.presentation);
  }

  const session = sessionTools.createWorkspaceSession({
    capture,
    comm: window.api.comm,
    links: document.querySelectorAll("[data-workspace-link]"),
    location: window.location,
    restore,
    workspace: "autopay",
  });
  session.start().catch(() => {});
})();
