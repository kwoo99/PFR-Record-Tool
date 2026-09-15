/**
 * Individual AutoPay contract editor.
 * Uses familiar fields for common edits while retaining exact API values behind
 * the form. Creation can resolve the customer's default payment method.
 */
(() => {
  const workspace = window.autoPayWorkspace;
  const { CHANNELS, state } = workspace;
  const editor = document.getElementById("contractEditor");
  const summary = document.getElementById("contractCustomerSummary");
  const status = document.getElementById("contractStatus");
  const schedulePreview = document.getElementById("contractSchedulePreview");
  const saveButton = document.getElementById("saveContractButton");
  const deleteButton = document.getElementById("deleteContractButton");
  let currentCustomer = null;
  let mode = "create";

  const fields = {
    AmountOption: document.getElementById("contractAmountOption"),
    ApplyCredits: document.getElementById("contractApplyCredits"),
    Currency: document.getElementById("contractCurrency"),
    Description: document.getElementById("contractDescription"),
    FixedAmount: document.getElementById("contractFixedAmount"),
    Frequency: document.getElementById("contractFrequency"),
    FrequencyInterval: document.getElementById("contractFrequencyInterval"),
    InvoiceTypes: document.getElementById("contractInvoiceTypes"),
    NextPaymentDate: document.getElementById("contractNextPaymentDate"),
    PaymentDay: document.getElementById("contractPaymentDay"),
    PaymentMethod: document.getElementById("contractPaymentMethod"),
  };

  function renderSchedulePreview() {
    const description = window.autoPayScheduleTiming.describeProcessDay(
      fields.NextPaymentDate.value,
      { timezone: state.connection?.timezone },
    );
    schedulePreview.querySelector("strong").textContent = description.headline;
    schedulePreview.querySelector("span").textContent = description.detail;
  }

  function setForm(contract = {}) {
    fields.AmountOption.value = contract.AmountOption || "Outstanding";
    fields.ApplyCredits.checked = Boolean(contract.ApplyCredits);
    fields.Currency.value =
      contract.Currency || currentCustomer.CurrencyCode || currentCustomer.Currency || "";
    fields.Description.value = contract.Description || "";
    fields.FixedAmount.value = contract.FixedAmount ?? 0;
    fields.Frequency.value = contract.Frequency || "Monthly";
    fields.FrequencyInterval.value = contract.FrequencyInterval ?? 1;
    fields.InvoiceTypes.value = Array.isArray(contract.InvoiceTypes)
      ? contract.InvoiceTypes.join("; ")
      : contract.InvoiceTypes || "";
    fields.NextPaymentDate.value = workspace.dateInputValue(contract.NextPaymentDate);
    fields.PaymentDay.value = contract.PaymentDay ?? "";
    fields.PaymentMethod.value = contract.PaymentMethod || "";
    fields.FixedAmount.disabled = fields.AmountOption.value !== "FixedAmount";
    renderSchedulePreview();
  }

  function readForm() {
    return {
      AmountOption: fields.AmountOption.value,
      ApplyCredits: fields.ApplyCredits.checked,
      Currency: fields.Currency.value.trim(),
      Description: fields.Description.value.trim(),
      FixedAmount: fields.FixedAmount.value,
      Frequency: fields.Frequency.value,
      FrequencyInterval: fields.FrequencyInterval.value,
      InvoiceTypes: fields.InvoiceTypes.value,
      NextPaymentDate: workspace.isoFromDateInput(fields.NextPaymentDate.value),
      PaymentDay: fields.PaymentDay.value,
      PaymentMethod: fields.PaymentMethod.value.trim(),
    };
  }

  async function openContract(customer) {
    currentCustomer = customer;
    editor.hidden = false;
    summary.textContent = `${customer.CustomerId}${customer.Name ? ` · ${customer.Name}` : ""}`;
    workspace.setStatus(status, "Loading the current contract…");
    saveButton.disabled = true;
    deleteButton.disabled = true;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });

    const result = await window.api.comm.invoke(
      CHANNELS.AUTOPAY_GET_CONTRACT,
      customer.CustomerId,
    );
    if (result.error) {
      workspace.setStatus(status, result.error, "error");
      return;
    }

    mode = result.data ? "update" : "create";
    setForm(result.data || {});
    saveButton.textContent = mode === "create" ? "Create Contract" : "Save Changes";
    deleteButton.hidden = mode === "create";
    saveButton.disabled = false;
    deleteButton.disabled = false;
    workspace.setStatus(
      status,
      mode === "create"
        ? "No contract was found. Complete the required fields to add AutoPay."
        : "Current contract loaded. Only this customer will be changed.",
    );
  }

  async function saveContract() {
    saveButton.disabled = true;
    workspace.setStatus(status, mode === "create" ? "Creating contract…" : "Saving changes…");
    const result = await window.api.comm.invoke(CHANNELS.AUTOPAY_SAVE_CONTRACT, {
      contract: readForm(),
      customerId: currentCustomer.CustomerId,
      mode,
    });
    saveButton.disabled = false;
    if (result.error) {
      workspace.setStatus(status, result.error, "error");
      return;
    }

    mode = "update";
    currentCustomer.NextAutoPay = workspace.isoFromDateInput(
      fields.NextPaymentDate.value,
    );
    currentCustomer.HasAutoPay = true;
    saveButton.textContent = "Save Changes";
    deleteButton.hidden = false;
    workspace.renderCustomers();
    workspace.setStatus(status, "Contract saved successfully.");
  }

  async function removeContract() {
    const production = state.connection?.environment === "Production";
    if (
      !window.confirm(
        `Remove AutoPay from ${currentCustomer.CustomerId}?${production ? " This changes a Production customer." : ""}`,
      )
    ) {
      return;
    }
    deleteButton.disabled = true;
    workspace.setStatus(status, "Removing contract…");
    const result = await window.api.comm.invoke(
      CHANNELS.AUTOPAY_DELETE_CONTRACT,
      currentCustomer.CustomerId,
    );
    deleteButton.disabled = false;
    if (result.error) {
      workspace.setStatus(status, result.error, "error");
      return;
    }
    currentCustomer.NextAutoPay = null;
    currentCustomer.HasAutoPay = false;
    mode = "create";
    setForm({});
    saveButton.textContent = "Create Contract";
    deleteButton.hidden = true;
    workspace.renderCustomers();
    workspace.setStatus(status, "AutoPay removed from this customer.");
  }

  fields.AmountOption.addEventListener("change", () => {
    fields.FixedAmount.disabled = fields.AmountOption.value !== "FixedAmount";
  });
  fields.NextPaymentDate.addEventListener("input", renderSchedulePreview);
  saveButton.addEventListener("click", saveContract);
  deleteButton.addEventListener("click", removeContract);
  document.getElementById("closeContractButton").addEventListener("click", () => {
    editor.hidden = true;
  });
  workspace.captureContractEditor = () => ({
    customerId: currentCustomer?.CustomerId || null,
    hidden: editor.hidden,
    mode,
  });
  workspace.restoreContractEditor = (snapshot = {}) => {
    currentCustomer = state.customers.find(
      (customer) => customer.CustomerId === snapshot.customerId,
    );
    mode = snapshot.mode === "update" ? "update" : "create";
    editor.hidden = snapshot.hidden !== false || !currentCustomer;
    if (!currentCustomer) return;
    summary.textContent = `${currentCustomer.CustomerId}${currentCustomer.Name ? ` · ${currentCustomer.Name}` : ""}`;
    saveButton.textContent = mode === "create" ? "Create Contract" : "Save Changes";
    deleteButton.hidden = mode === "create";
    fields.FixedAmount.disabled = fields.AmountOption.value !== "FixedAmount";
    renderSchedulePreview();
  };
  workspace.refreshContractSchedulePreview = renderSchedulePreview;
  workspace.openContract = openContract;
  renderSchedulePreview();
})();
