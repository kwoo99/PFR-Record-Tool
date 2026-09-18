/**
 * Filtered customer discovery and selection table.
 * Holds every loaded result for selection/search while rendering at most 500 rows
 * so large portals remain responsive.
 */
(() => {
  const workspace = window.autoPayWorkspace;
  const { CHANNELS, state } = workspace;
  const RENDER_LIMIT = 500;

  const fetchButton = document.getElementById("fetchCustomersButton");
  const loadStatus = document.getElementById("customerLoadStatus");
  const customerRows = document.getElementById("customerRows");
  const customerCount = document.getElementById("customerCount");
  const customerSearch = document.getElementById("customerSearch");
  const selectAll = document.getElementById("selectAllCustomers");
  const selectedCount = document.getElementById("selectedCount");
  const renderLimitNotice = document.getElementById("renderLimitNotice");
  const exportButton = document.getElementById("exportSelectedCustomersButton");
  const exportStatus = document.getElementById("customerExportStatus");

  let matchingCustomers = [];

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function filters() {
    return {
      activeUsersMax: value("activeUsersMaxFilter"),
      activeUsersMin: value("activeUsersMinFilter"),
      creditBalanceMax: value("creditBalanceMaxFilter"),
      creditBalanceMin: value("creditBalanceMinFilter"),
      currencyCode: value("currencyFilter"),
      customerId: value("customerIdFilter"),
      email: value("emailFilter"),
      invoiceBalanceMax: value("invoiceBalanceMaxFilter"),
      invoiceBalanceMin: value("invoiceBalanceMinFilter"),
      name: value("nameFilter"),
      nextAutoPayMax: value("nextAutoPayMaxFilter"),
      nextAutoPayMin: value("nextAutoPayMinFilter"),
      pastDueBalanceMax: value("pastDueBalanceMaxFilter"),
      pastDueBalanceMin: value("pastDueBalanceMinFilter"),
    };
  }

  function updateSelectionState() {
    const matchingIds = matchingCustomers.map((customer) => customer.CustomerId);
    const selectedMatching = matchingIds.filter((id) =>
      state.selectedCustomerIds.has(id),
    ).length;
    selectAll.checked = matchingIds.length > 0 && selectedMatching === matchingIds.length;
    selectAll.indeterminate = selectedMatching > 0 && selectedMatching < matchingIds.length;
    selectedCount.textContent = `${state.selectedCustomerIds.size.toLocaleString()} Selected`;
    exportButton.disabled =
      exportButton.dataset.loading === "true" || state.selectedCustomerIds.size === 0;
    document.querySelectorAll(".customer-checkbox").forEach((checkbox) => {
      checkbox.checked = state.selectedCustomerIds.has(checkbox.dataset.customerId);
    });
    workspace.onSelectionChanged();
  }

  function customerSearchText(customer) {
    return [
      customer.CustomerId,
      customer.Name,
      customer.Email,
      customer.CurrencyCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function appendCell(row, text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    row.append(cell);
    return cell;
  }

  function renderRows() {
    const query = customerSearch.value.trim().toLowerCase();
    matchingCustomers = state.customers.filter((customer) =>
      customerSearchText(customer).includes(query),
    );
    const rendered = matchingCustomers.slice(0, RENDER_LIMIT);
    const fragment = document.createDocumentFragment();

    if (!rendered.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = appendCell(
        row,
        state.customers.length ? "No loaded customers match this search." : "Fetch customers to begin.",
      );
      cell.colSpan = 7;
      fragment.append(row);
    }

    for (const customer of rendered) {
      const row = document.createElement("tr");
      row.dataset.customerId = customer.CustomerId;
      const selectCell = document.createElement("td");
      selectCell.className = "check-column";
      const checkbox = document.createElement("input");
      checkbox.className = "customer-checkbox";
      checkbox.dataset.customerId = customer.CustomerId;
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", `Select ${customer.CustomerId}`);
      selectCell.append(checkbox);
      row.append(selectCell);

      const customerCell = appendCell(row, customer.CustomerId);
      const name = document.createElement("span");
      name.className = "customer-name";
      name.textContent = customer.Name || customer.Email || "No Name";
      customerCell.append(name);
      appendCell(row, customer.CurrencyCode || customer.Currency || "—");
      appendCell(
        row,
        workspace.formatMoney(
          customer.InvoiceBalance,
          customer.CurrencyCode || customer.Currency,
        ),
      );
      appendCell(
        row,
        workspace.formatMoney(
          customer.PastDueBalance,
          customer.CurrencyCode || customer.Currency,
        ),
      );

      const autoPayCell = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = `status-chip ${customer.HasAutoPay ? "is-on" : "is-off"}`;
      chip.textContent = customer.HasAutoPay
        ? `On · ${workspace.dateInputValue(customer.NextAutoPay)}`
        : "Not on AutoPay";
      autoPayCell.append(chip);
      row.append(autoPayCell);

      const actionCell = document.createElement("td");
      const action = document.createElement("button");
      action.className = "row-action";
      action.dataset.action = "view-contract";
      action.dataset.customerId = customer.CustomerId;
      action.type = "button";
      action.textContent = customer.HasAutoPay ? "View Contract" : "Add AutoPay";
      actionCell.append(action);
      row.append(actionCell);
      fragment.append(row);
    }

    customerRows.replaceChildren(fragment);
    const hiddenCount = matchingCustomers.length - rendered.length;
    renderLimitNotice.textContent = hiddenCount > 0
      ? `Showing the first ${RENDER_LIMIT.toLocaleString()} of ${matchingCustomers.length.toLocaleString()} matches. Search narrows the full loaded list.`
      : matchingCustomers.length
        ? `Showing ${matchingCustomers.length.toLocaleString()} matching customer${matchingCustomers.length === 1 ? "" : "s"}.`
        : "";
    updateSelectionState();
  }

  async function loadCustomers() {
    fetchButton.disabled = true;
    workspace.setStatus(loadStatus, "Loading customers from the portal…");
    try {
      const result = await window.api.comm.invoke(CHANNELS.AUTOPAY_LIST_CUSTOMERS, {
        autoPayStatus: document.getElementById("autoPayStatusFilter").value,
        filters: filters(),
      });
      if (result.error) throw new Error(result.error);
      state.customers = result.customers;
      state.selectedCustomerIds.clear();
      customerSearch.disabled = !state.customers.length;
      selectAll.disabled = !state.customers.length;
      customerSearch.value = "";
      customerCount.textContent = `${state.customers.length.toLocaleString()} Customer${state.customers.length === 1 ? "" : "s"} Loaded`;
      workspace.setStatus(
        loadStatus,
        state.customers.length
          ? `Loaded ${state.customers.length.toLocaleString()} customers. AutoPay status is based on the portal report and will be verified before changes.`
          : "No customers matched these filters.",
      );
      renderRows();
      workspace.onCustomersChanged();
    } catch (error) {
      workspace.setStatus(
        loadStatus,
        `${error.message}. Check the connection and filters, then try again.`,
        "error",
      );
    } finally {
      fetchButton.disabled = !state.connection?.configured;
    }
  }

  async function exportSelectedCustomers() {
    const customers = workspace.selectedCustomers();
    if (!customers.length) {
      workspace.setStatus(exportStatus, "Select at least one customer to export.", "error");
      return;
    }

    exportButton.dataset.loading = "true";
    exportButton.disabled = true;
    workspace.setStatus(exportStatus, "Choose where to save the customer workbook…");
    try {
      const result = await window.api.comm.invoke(
        CHANNELS.AUTOPAY_EXPORT_CUSTOMERS,
        customers,
      );
      if (!result) {
        workspace.setStatus(exportStatus, "Customer export cancelled.");
        return;
      }
      if (result.error) {
        workspace.setStatus(exportStatus, result.error, "error");
        return;
      }
      if (result.failed || result.missing) {
        const details = [
          result.missing
            ? `${result.missing.toLocaleString()} without an available wallet`
            : "",
          result.failed
            ? `${result.failed.toLocaleString()} wallet lookup${result.failed === 1 ? "" : "s"} failed`
            : "",
        ].filter(Boolean).join("; ");
        workspace.setStatus(
          exportStatus,
          `Saved ${result.total.toLocaleString()} customers to ${result.fileName}. ${details}. Review the Wallet Source column in the workbook.`,
          result.failed ? "error" : "warning",
        );
      } else {
        workspace.setStatus(
          exportStatus,
          `Saved ${result.total.toLocaleString()} customers to ${result.fileName}.`,
          "success",
        );
      }
    } catch (error) {
      workspace.setStatus(
        exportStatus,
        `Could not export the selected customers: ${error.message}`,
        "error",
      );
    } finally {
      delete exportButton.dataset.loading;
      updateSelectionState();
    }
  }

  fetchButton.addEventListener("click", loadCustomers);
  exportButton.addEventListener("click", exportSelectedCustomers);
  customerSearch.addEventListener("input", renderRows);
  selectAll.addEventListener("change", () => {
    for (const customer of matchingCustomers) {
      if (selectAll.checked) state.selectedCustomerIds.add(customer.CustomerId);
      else state.selectedCustomerIds.delete(customer.CustomerId);
    }
    updateSelectionState();
  });
  customerRows.addEventListener("change", (event) => {
    if (!event.target.classList.contains("customer-checkbox")) return;
    if (event.target.checked) state.selectedCustomerIds.add(event.target.dataset.customerId);
    else state.selectedCustomerIds.delete(event.target.dataset.customerId);
    updateSelectionState();
  });
  customerRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='view-contract']");
    if (!button) return;
    const customer = state.customers.find(
      (item) => item.CustomerId === button.dataset.customerId,
    );
    if (customer) workspace.openContract(customer);
  });
  window.api.comm.receive(CHANNELS.AUTOPAY_EXPORT_PROGRESS, (progress) => {
    if (exportButton.dataset.loading !== "true") return;
    workspace.setStatus(
      exportStatus,
      `Retrieving wallet GUIDs: ${progress.completed.toLocaleString()} of ${progress.total.toLocaleString()}.`,
    );
  });

  workspace.renderCustomers = renderRows;
  workspace.restoreCustomerWorkspace = () => {
    const hasCustomers = state.customers.length > 0;
    customerSearch.disabled = !hasCustomers;
    selectAll.disabled = !hasCustomers;
    customerCount.textContent = hasCustomers
      ? `${state.customers.length.toLocaleString()} Customer${state.customers.length === 1 ? "" : "s"} Loaded`
      : "No Customers Loaded";
    renderRows();
  };
  workspace.selectedCustomers = () =>
    state.customers.filter((customer) =>
      state.selectedCustomerIds.has(customer.CustomerId),
    );
})();
