/**
 * AutoPay contract mapping and validation.
 * Keeps PayFabric field rules out of IPC and renderer code so JSON, workbook,
 * existing-template, and individual-editor flows build contracts consistently.
 */
const workbookSchema = require("../../shared/autopay-workbook-schema.js");

function workbookOptions(fieldName) {
  const field = workbookSchema.fields.find((entry) => entry.name === fieldName);
  return new Set(field?.options ?? []);
}

const AMOUNT_OPTIONS = workbookOptions("AmountOption");
const FREQUENCIES = workbookOptions("Frequency");

// These are the fields accepted by a customer contract mutation. Workbook-only
// routing fields intentionally stay in the shared workbook schema instead.
const CONTRACT_FIELDS = [
  "AmountOption",
  "ApplyCredits",
  "Currency",
  "CustomerId",
  "Description",
  "FixedAmount",
  "Frequency",
  "FrequencyInterval",
  "InvoiceTypes",
  "NextPaymentDate",
  "PaymentDay",
  "PaymentMethod",
];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (isBlank(value)) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error(`ApplyCredits must be true or false, received ${value}`);
}

function parseInvoiceTypes(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (isBlank(value)) return [];
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value, fieldName, { integer = false } = {}) {
  if (isBlank(value)) return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || (integer && !Number.isInteger(result))) {
    throw new Error(`${fieldName} must be a valid ${integer ? "integer" : "number"}`);
  }
  return result;
}

function copyContractFields(source) {
  const result = {};
  for (const field of CONTRACT_FIELDS) {
    if (source[field] !== undefined && source[field] !== null) {
      result[field] = source[field];
    }
  }
  return result;
}

function normalizeConfiguration(configuration = {}) {
  const result = copyContractFields(configuration);

  if (configuration.StartDay !== undefined && result.PaymentDay === undefined) {
    result.PaymentDay = configuration.StartDay;
  }
  result.ApplyCredits = parseBoolean(result.ApplyCredits);
  result.InvoiceTypes = parseInvoiceTypes(result.InvoiceTypes);
  result.FixedAmount = parseNumber(result.FixedAmount, "FixedAmount");
  result.FrequencyInterval = parseNumber(
    result.FrequencyInterval,
    "FrequencyInterval",
    { integer: true },
  );
  result.PaymentDay = parseNumber(result.PaymentDay, "PaymentDay", {
    integer: true,
  });

  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) delete result[key];
  }
  return result;
}

function normalizeConfigurationPatch(configuration = {}) {
  const explicit = {};
  for (const field of CONTRACT_FIELDS) {
    if (!Object.hasOwn(configuration, field)) continue;
    const value = configuration[field];
    if (Array.isArray(value) || !isBlank(value)) explicit[field] = value;
  }
  if (
    !Object.hasOwn(explicit, "PaymentDay") &&
    Object.hasOwn(configuration, "StartDay") &&
    !isBlank(configuration.StartDay)
  ) {
    explicit.StartDay = configuration.StartDay;
  }

  const normalized = normalizeConfiguration(explicit);
  // normalizeConfiguration supplies an empty list for create/template flows.
  // A patch must omit InvoiceTypes unless the user explicitly supplied it.
  if (!Object.hasOwn(explicit, "InvoiceTypes")) delete normalized.InvoiceTypes;
  return normalized;
}

function validateContract(contract, { create = true } = {}) {
  if (isBlank(contract.CustomerId)) {
    throw new Error("CustomerId is required");
  }
  if (!create) return contract;

  if (!AMOUNT_OPTIONS.has(contract.AmountOption)) {
    throw new Error("AmountOption must be Outstanding, PastDue, or FixedAmount");
  }
  if (!FREQUENCIES.has(contract.Frequency)) {
    throw new Error("Frequency must be Daily, Monthly, Quarterly, or Annually");
  }
  if (isBlank(contract.NextPaymentDate)) {
    throw new Error("NextPaymentDate is required when applying AutoPay");
  }
  if (Number.isNaN(Date.parse(contract.NextPaymentDate))) {
    throw new Error("NextPaymentDate must be a valid date");
  }
  if (isBlank(contract.PaymentMethod)) {
    throw new Error("No payment method is available for this customer");
  }
  if (
    contract.AmountOption === "FixedAmount" &&
    (!Number.isFinite(contract.FixedAmount) || contract.FixedAmount <= 0)
  ) {
    throw new Error("FixedAmount must be greater than zero for FixedAmount AutoPay");
  }
  return contract;
}

function buildAutoPayContract({
  configuration,
  customer,
  fixedAmount,
  nextPaymentDate,
  paymentMethod,
}) {
  const normalized = normalizeConfiguration(configuration);
  const customerId = customer.CustomerId ?? customer.CustomerID ?? customer.customerId;
  const usesCustomerCurrency = configuration.CurrencyOption === "CustomerCurrency";
  const currency = usesCustomerCurrency
    ? customer.CurrencyCode ?? customer.Currency
    : normalized.Currency || customer.CurrencyCode || customer.Currency;

  const contract = {
    ...normalized,
    CustomerId: customerId,
    Currency: currency,
    FixedAmount:
      parseNumber(fixedAmount, "FixedAmount") ?? normalized.FixedAmount ?? 0,
    FrequencyInterval: normalized.FrequencyInterval ?? 1,
    NextPaymentDate: nextPaymentDate ?? normalized.NextPaymentDate,
    PaymentMethod: paymentMethod ?? normalized.PaymentMethod,
  };

  return validateContract(contract);
}

function scalarIdentifier(value) {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function extractPaymentMethod(
  data,
  { allowGenericId = true, seen = new WeakSet() } = {},
) {
  const scalar = scalarIdentifier(data);
  if (scalar) return scalar;
  if (!data || typeof data !== "object" || seen.has(data)) return undefined;
  seen.add(data);

  for (const value of [
    data.PaymentMethod,
    data.PaymentMethodGuid,
    data.PaymentMethodId,
    data.WalletGuid,
    data.WalletEntryGuid,
    data.WalletEntryID,
    data.WalletEntryId,
    data.WalletID,
    data.WalletId,
    data.CardGuid,
  ]) {
    const identifier =
      scalarIdentifier(value) ||
      extractPaymentMethod(value, { allowGenericId: true, seen });
    if (identifier) return identifier;
  }

  if (allowGenericId) {
    for (const value of [data.Guid, data.ID, data.Id]) {
      const identifier = scalarIdentifier(value);
      if (identifier) return identifier;
    }
  }
  return extractPaymentMethod(data.Data, { allowGenericId, seen });
}

function extractContractPaymentMethod(data) {
  return extractPaymentMethod(data, { allowGenericId: false });
}

function normalizeTemplateRequest(template = {}) {
  const normalized = normalizeConfiguration(template);
  const request = {
    AmountOption: normalized.AmountOption,
    ApplyCredits: normalized.ApplyCredits,
    Currency: normalized.Currency,
    Description: normalized.Description,
    FixedAmount: normalized.FixedAmount,
    FixedAmountOption: template.FixedAmountOption,
    Frequency: normalized.Frequency,
    FrequencyInterval: normalized.FrequencyInterval,
    InvoiceTypes: normalized.InvoiceTypes,
    Name: template.Name,
    PaymentDay: normalized.PaymentDay,
    StartOption: template.StartOption ?? template.Start,
  };
  for (const [field, value] of Object.entries(request)) {
    if (value === undefined || value === null || value === "") delete request[field];
  }
  if (isBlank(request.Name)) throw new Error("A new portal template requires a Name");
  return request;
}

module.exports = {
  buildAutoPayContract,
  extractContractPaymentMethod,
  extractPaymentMethod,
  normalizeConfiguration,
  normalizeConfigurationPatch,
  normalizeTemplateRequest,
  validateContract,
};
