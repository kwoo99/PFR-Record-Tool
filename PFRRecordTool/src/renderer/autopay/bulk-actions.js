/**
 * Bulk AutoPay source selection, guarded actions, and lifecycle presentation.
 * Keeps portal templates, JSON, and workbook assignments explicit before the
 * selected customer group enters the bounded main-process worker queue.
 */
(() => {
  const workspace = window.autoPayWorkspace;
  const { CHANNELS, state } = workspace;
  const sourceSelect = document.getElementById("contractSource");
  const sourcePanels = {
    json: document.getElementById("jsonSource"),
    template: document.getElementById("templateSource"),
    workbook: document.getElementById("workbookSource"),
  };
  const status = document.getElementById("bulkActionStatus");
  const applyButton = document.getElementById("applyAutoPayButton");
  const removeButton = document.getElementById("removeAutoPayButton");
  const saveTemplateButton = document.getElementById("saveTemplateButton");
  const templateSelect = document.getElementById("templateSelect");
  const progressPanel = document.getElementById("bulkProgress");
  const activity = document.getElementById("autoPayActivity");
  const pauseButton = document.getElementById("pauseAutoPayButton");
  const resumeButton = document.getElementById("resumeAutoPayButton");
  const retryButton = document.getElementById("retryAutoPayButton");
  const bulkNextPaymentDate = document.getElementById("bulkNextPaymentDate");
  const schedulePreview = document.getElementById("bulkSchedulePreview");
  const selectionSummary = document.getElementById("bulkSelectionSummary");

  function renderSchedulePreview() {
    const description = window.autoPayScheduleTiming.describeProcessDay(
      bulkNextPaymentDate.value,
      { bulk: true, timezone: state.connection?.timezone },
    );
    schedulePreview.querySelector("strong").textContent = description.headline;
    schedulePreview.querySelector("span").textContent = description.detail;
  }

  function updateActionAvailability() {
    const selectionCount = state.selectedCustomerIds.size;
    const hasSelection = selectionCount > 0;
    selectionSummary.textContent = `${selectionCount.toLocaleString()} Customer${selectionCount === 1 ? "" : "s"} Selected`;
    applyButton.disabled = !hasSelection;
    removeButton.disabled = !hasSelection;
    saveTemplateButton.hidden = sourceSelect.value === "template";
  }

  function showSource() {
    for (const [name, panel] of Object.entries(sourcePanels)) {
      panel.hidden = name !== sourceSelect.value;
    }
    updateActionAvailability();
  }

  function selectedTemplate() {
    return state.templates.find(
      (template) => template.AutoPayTemplateGuid === templateSelect.value,
    );
  }

  function renderTemplates(selectedGuid = "") {
    templateSelect.replaceChildren();
    if (!state.templates.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Load Templates First";
      templateSelect.append(option);
      templateSelect.disabled = true;
      return;
    }

    for (const template of state.templates) {
      const option = document.createElement("option");
      option.value = template.AutoPayTemplateGuid;
      option.textContent = template.Name;
      templateSelect.append(option);
    }
    templateSelect.disabled = false;
    if (selectedGuid) templateSelect.value = selectedGuid;
  }

  function parseJSONConfiguration() {
    const text = document.getElementById("configurationJson").value.trim();
    if (!text) throw new Error("Paste an AutoPay JSON configuration first");
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("AutoPay JSON must contain one configuration object");
    }
    return parsed;
  }

  function sharedOptions(configuration) {
    return {
      configuration,
      fixedAmount: document.getElementById("bulkFixedAmount").value || undefined,
      nextPaymentDate: workspace.isoFromDateInput(
        bulkNextPaymentDate.value,
      ),
      paymentMethod:
        document.getElementById("bulkPaymentMethod").value.trim() || undefined,
    };
  }

  function workbookOperation(customers) {
    if (!state.workbook) throw new Error("Choose an Excel workbook first");
    if (!state.workbook.assignments.length) {
      if (!state.workbook.templates.length) {
        throw new Error("The workbook contains no AutoPay configuration");
      }
      return {
        customers,
        options: sharedOptions(state.workbook.templates[0]),
      };
    }

    const templatesByName = new Map(
      state.workbook.templates.map((template) => [template.Name, template]),
    );
    const assignments = {};
    for (const assignment of state.workbook.assignments) {
      const base = assignment.TemplateName
        ? templatesByName.get(assignment.TemplateName) ?? {}
        : {};
      assignments[assignment.CustomerId] = {
        ...sharedOptions({ ...base, ...assignment }),
        fixedAmount:
          assignment.FixedAmount ??
          (document.getElementById("bulkFixedAmount").value || undefined),
        nextPaymentDate:
          assignment.NextPaymentDate ??
          workspace.isoFromDateInput(
            bulkNextPaymentDate.value,
          ),
        paymentMethod:
          assignment.PaymentMethod ??
          (document.getElementById("bulkPaymentMethod").value.trim() || undefined),
      };
    }
    const assignedCustomers = customers.filter(
      (customer) => assignments[customer.CustomerId],
    );
    if (!assignedCustomers.length) {
      throw new Error("No selected customer has an Assignments row in this workbook");
    }
    return {
      customers: assignedCustomers,
      options: { assignments },
      omitted: customers.length - assignedCustomers.length,
    };
  }

  function operationRequest() {
    const customers = workspace.selectedCustomers();
    if (!customers.length) throw new Error("Select at least one customer");
    if (sourceSelect.value === "workbook") return workbookOperation(customers);

    let configuration;
    if (sourceSelect.value === "template") {
      configuration = selectedTemplate();
      if (!configuration) throw new Error("Load and choose a portal template first");
    } else {
      configuration = parseJSONConfiguration();
    }
    return { customers, options: sharedOptions(configuration) };
  }

  async function loadTemplates() {
    const customer = workspace.selectedCustomers()[0] ?? state.customers[0];
    if (!customer) {
      workspace.setStatus(status, "Load at least one customer before templates.", "error");
      return;
    }
    workspace.setStatus(status, "Loading portal templates…");
    const result = await window.api.comm.invoke(
      CHANNELS.AUTOPAY_LIST_TEMPLATES,
      customer.CustomerId,
    );
    if (result.error) {
      workspace.setStatus(status, result.error, "error");
      return;
    }
    state.templates = Array.isArray(result.data) ? result.data : [];
    if (!state.templates.length) {
      renderTemplates();
      templateSelect.options[0].textContent = "No Templates Found";
      workspace.setStatus(status, "No AutoPay templates were found.");
      return;
    }
    renderTemplates();
    workspace.setStatus(status, `Loaded ${state.templates.length} portal templates.`);
  }

  async function importWorkbook() {
    workspace.setStatus(status, "Reading workbook…");
    const result = await window.api.comm.invoke(CHANNELS.AUTOPAY_IMPORT_WORKBOOK);
    if (!result) {
      workspace.setStatus(status, "Workbook selection cancelled.");
      return;
    }
    if (result.error) {
      workspace.setStatus(status, result.error, "error");
      return;
    }
    state.workbook = result;
    document.getElementById("workbookSummary").textContent =
      `${result.fileName}: ${result.templates.length} template row${result.templates.length === 1 ? "" : "s"}, ${result.assignments.length} assignment row${result.assignments.length === 1 ? "" : "s"}.`;
    workspace.setStatus(status, "Workbook loaded. Review the selected customers before applying.");
  }

  async function downloadWorkbook() {
    workspace.setStatus(status, "Choose where to save the blank workbook…");
    try {
      const result = await window.api.comm.invoke(
        CHANNELS.AUTOPAY_DOWNLOAD_WORKBOOK,
      );
      if (!result) {
        workspace.setStatus(status, "Workbook download cancelled.");
        return;
      }
      if (result.error) {
        workspace.setStatus(status, result.error, "error");
        return;
      }
      workspace.setStatus(status, "");
    } catch (error) {
      workspace.setStatus(status, `Could not save the workbook: ${error.message}`, "error");
    }
  }

  async function startBulk(operation) {
    let request;
    try {
      request = operation === "remove"
        ? { customers: workspace.selectedCustomers() }
        : operationRequest();
      if (!request.customers.length) throw new Error("Select at least one customer");
    } catch (error) {
      workspace.setStatus(status, error.message, "error");
      return;
    }

    const production = state.connection?.environment === "Production";
    const verb = operation === "remove" ? "remove AutoPay from" : "apply AutoPay to";
    const omitted = request.omitted
      ? ` ${request.omitted} selected customers without workbook assignments will not be included.`
      : "";
    if (
      !window.confirm(
        `Ready to ${verb} ${request.customers.length} customer${request.customers.length === 1 ? "" : "s"}.${omitted}${production ? " This will change Production data." : ""}`,
      )
    ) {
      return;
    }

    progressPanel.hidden = false;
    activity.replaceChildren();
    applyButton.disabled = true;
    removeButton.disabled = true;
    workspace.setStatus(status, "AutoPay operation started.");
    try {
      await window.api.comm.invoke(CHANNELS.AUTOPAY_START_BULK, {
        customers: request.customers,
        operation,
        options: request.options ?? {},
      });
    } catch (error) {
      workspace.setStatus(status, error.message, "error");
    } finally {
      updateActionAvailability();
    }
  }

  async function saveTemplate() {
    let template;
    try {
      if (sourceSelect.value === "json") template = parseJSONConfiguration();
      else if (sourceSelect.value === "workbook") {
        template = state.workbook?.templates[0];
        if (!template) throw new Error("The workbook has no Templates row to save");
      } else return;
      if (!template.Name) throw new Error("A new portal template requires a Name");
    } catch (error) {
      workspace.setStatus(status, error.message, "error");
      return;
    }
    const production = state.connection?.environment === "Production";
    if (
      !window.confirm(
        `Save “${template.Name}” as a new portal template?${production ? " This changes Production settings." : ""}`,
      )
    ) return;

    const result = await window.api.comm.invoke(
      CHANNELS.AUTOPAY_SAVE_TEMPLATE,
      template,
    );
    workspace.setStatus(status, result.error || "", result.error ? "error" : "success");
  }

  function renderProgress(progress) {
    progressPanel.hidden = false;
    document.getElementById("progressPercent").textContent = `${progress.progress}%`;
    const bar = document.getElementById("progressBar");
    bar.value = progress.progress;
    bar.textContent = `${progress.progress}%`;
    document.getElementById("progressSummary").textContent =
      `${progress.status === "paused" ? "Paused" : progress.status === "completed" ? "Cycle complete" : "Working"} · ${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} checked · ${progress.concurrency} worker${progress.concurrency === 1 ? "" : "s"}`;
    document.getElementById("progressSucceeded").textContent = `${progress.succeeded.toLocaleString()} Changed`;
    document.getElementById("progressSkipped").textContent = `${progress.skipped.toLocaleString()} Skipped`;
    document.getElementById("progressFailed").textContent = `${progress.failed.toLocaleString()} Failed`;
    document.getElementById("progressRemaining").textContent = `${progress.remaining.toLocaleString()} Remaining`;
    pauseButton.hidden = !progress.canCancel;
    resumeButton.hidden = !progress.canResume;
    retryButton.hidden = !progress.canRetry;
    if (progress.status === "completed") {
      workspace.setStatus(
        status,
        `Cycle complete: ${progress.succeeded} changed, ${progress.skipped} skipped, and ${progress.failed} failed.`,
        progress.failed ? "error" : "success",
      );
    }
  }

  function appendResult(result) {
    const entry = document.createElement("div");
    entry.className = `activity-entry is-${result.outcome}`;
    entry.textContent = `${result.customerId}: ${result.message}`;
    activity.prepend(entry);
  }

  function renderResults(results = []) {
    activity.replaceChildren();
    for (const result of results) appendResult(result);
  }

  sourceSelect.addEventListener("change", showSource);
  bulkNextPaymentDate.addEventListener("input", renderSchedulePreview);
  document.getElementById("loadTemplatesButton").addEventListener("click", loadTemplates);
  document.getElementById("importWorkbookButton").addEventListener("click", importWorkbook);
  document.getElementById("downloadWorkbookButton").addEventListener("click", downloadWorkbook);
  applyButton.addEventListener("click", () => startBulk("apply"));
  removeButton.addEventListener("click", () => startBulk("remove"));
  saveTemplateButton.addEventListener("click", saveTemplate);
  pauseButton.addEventListener("click", () =>
    window.api.comm.send(CHANNELS.AUTOPAY_CANCEL_BULK),
  );
  resumeButton.addEventListener("click", () =>
    window.api.comm.invoke(CHANNELS.AUTOPAY_RESUME_BULK).catch((error) =>
      workspace.setStatus(status, error.message, "error"),
    ),
  );
  retryButton.addEventListener("click", () =>
    window.api.comm.invoke(CHANNELS.AUTOPAY_RETRY_BULK).catch((error) =>
      workspace.setStatus(status, error.message, "error"),
    ),
  );
  document.getElementById("clearActivityButton").addEventListener("click", () => {
    activity.replaceChildren();
    window.api.comm.invoke(CHANNELS.AUTOPAY_CLEAR_RESULTS).catch(() => {});
  });
  window.api.comm.receive(CHANNELS.AUTOPAY_PROGRESS, renderProgress);
  window.api.comm.receive(CHANNELS.AUTOPAY_RESULT, appendResult);
  workspace.onSelectionChanged = updateActionAvailability;
  workspace.onCustomersChanged = updateActionAvailability;
  workspace.refreshBulkSource = showSource;
  workspace.refreshBulkSchedulePreview = renderSchedulePreview;
  workspace.renderTemplates = renderTemplates;
  showSource();
  renderSchedulePreview();
  window.api.comm
    .invoke(CHANNELS.AUTOPAY_GET_PROGRESS)
    .then((progress) => {
      renderResults(progress.results);
      if (progress.status !== "idle") renderProgress(progress);
    })
    .catch(() => {});
})();
