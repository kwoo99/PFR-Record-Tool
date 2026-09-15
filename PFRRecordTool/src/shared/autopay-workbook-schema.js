/**
 * Shared AutoPay workbook contract.
 * The importer, downloadable workbook, and Help reference all use this catalog
 * so supported headers and user guidance cannot drift apart.
 */
(function initializeAutoPayWorkbookSchema(root) {
  const templateFields = [
    "Name",
    "Description",
    "AmountOption",
    "FixedAmountOption",
    "FixedAmount",
    "Currency",
    "CurrencyOption",
    "Frequency",
    "FrequencyInterval",
    "StartOption",
    "PaymentDay",
    "InvoiceTypeOption",
    "InvoiceTypes",
    "ApplyCredits",
    "NextPaymentDate",
    "PaymentMethod",
  ];

  const assignmentFields = [
    "CustomerId",
    "TemplateName",
    "Description",
    "AmountOption",
    "FixedAmount",
    "Currency",
    "CurrencyOption",
    "Frequency",
    "FrequencyInterval",
    "PaymentDay",
    "InvoiceTypes",
    "ApplyCredits",
    "NextPaymentDate",
    "PaymentMethod",
  ];

  const fields = [
    {
      description: "Unique name used to identify a reusable configuration.",
      example: "Monthly outstanding balance",
      name: "Name",
      required: "Required on Templates",
      sheets: ["Templates"],
      type: "Text (50 characters)",
    },
    {
      description: "Customer ID that will receive the AutoPay contract.",
      example: "CUST-1001",
      name: "CustomerId",
      required: "Required on Assignments",
      sheets: ["Assignments"],
      type: "Text (25 characters)",
    },
    {
      description: "Name of a row on Templates. Leave blank when the assignment supplies its full configuration.",
      example: "Monthly outstanding balance",
      name: "TemplateName",
      required: "Optional",
      sheets: ["Assignments"],
      type: "Text",
    },
    {
      description: "Internal description of the AutoPay configuration.",
      example: "Pay the open balance every month",
      name: "Description",
      required: "Optional",
      sheets: ["Templates", "Assignments"],
      type: "Text (255 characters)",
    },
    {
      description: "Controls which balance the recurring payment collects.",
      example: "Outstanding",
      name: "AmountOption",
      options: ["Outstanding", "PastDue", "FixedAmount"],
      required: "Required when creating AutoPay",
      sheets: ["Templates", "Assignments"],
      type: "Option",
    },
    {
      description: "Controls whether a fixed amount is predetermined or left for the user to choose. None is used when fixed amount is not active.",
      example: "Preselected",
      name: "FixedAmountOption",
      options: ["None", "Preselected", "UserChoice"],
      required: "Optional; Templates only",
      sheets: ["Templates"],
      type: "Option",
    },
    {
      description: "Amount charged when AmountOption is FixedAmount.",
      example: "125.50",
      name: "FixedAmount",
      required: "Required for FixedAmount",
      sheets: ["Templates", "Assignments"],
      type: "Decimal greater than 0",
    },
    {
      description: "Currency code assigned to the AutoPay contract.",
      example: "USD",
      name: "Currency",
      required: "Optional when customer currency is used",
      sheets: ["Templates", "Assignments"],
      type: "Text (10 characters)",
    },
    {
      description: "Uses either each customer's currency or the Currency column.",
      example: "CustomerCurrency",
      name: "CurrencyOption",
      options: ["CustomerCurrency", "SelectedCurrency"],
      required: "Optional",
      sheets: ["Templates", "Assignments"],
      type: "Option",
    },
    {
      description: "Base schedule used for recurring payments.",
      example: "Monthly",
      name: "Frequency",
      options: ["Daily", "Monthly", "Quarterly", "Annually"],
      required: "Required when creating AutoPay",
      sheets: ["Templates", "Assignments"],
      type: "Option",
    },
    {
      description: "Number of frequency units between payment cycles.",
      example: "1",
      name: "FrequencyInterval",
      required: "Optional; defaults to 1",
      sheets: ["Templates", "Assignments"],
      type: "Positive integer",
    },
    {
      description: "Controls how a reusable template chooses its starting date.",
      example: "UserChoice",
      name: "StartOption",
      options: [
        "None",
        "DayOfTheMonth",
        "DayOfTheWeek",
        "NextDay",
        "UserChoice",
      ],
      required: "Optional; Templates only",
      sheets: ["Templates"],
      type: "Option",
    },
    {
      description: "Day of the month or week on which the AutoPay cycle begins. Its meaning depends on Frequency and StartOption.",
      example: "15",
      name: "PaymentDay",
      required: "Optional",
      sheets: ["Templates", "Assignments"],
      type: "Integer",
    },
    {
      description: "Controls whether a template covers all invoice types or only the listed InvoiceTypes.",
      example: "AllInvoices",
      name: "InvoiceTypeOption",
      options: ["AllInvoices", "SelectedInvoices"],
      required: "Optional; Templates only",
      sheets: ["Templates"],
      type: "Option",
    },
    {
      description: "Invoice type IDs included in AutoPay. Separate multiple values with semicolons or commas. Leave blank for all invoice types.",
      example: "STANDARD; SERVICE",
      name: "InvoiceTypes",
      required: "Optional",
      sheets: ["Templates", "Assignments"],
      type: "Text list",
    },
    {
      description: "Applies available customer credits before processing payment.",
      example: "true",
      name: "ApplyCredits",
      options: ["true", "false"],
      required: "Optional",
      sheets: ["Templates", "Assignments"],
      type: "Boolean",
    },
    {
      description: "Next date on which the customer's AutoPay contract will process.",
      example: "10/15/2026",
      name: "NextPaymentDate",
      required: "Required when creating AutoPay",
      sheets: ["Templates", "Assignments"],
      type: "Date",
    },
    {
      description: "Customer payment-method GUID. Leave blank to let the app use that customer's default payment method.",
      example: "015eb504-46c3-4574-907c-e9f30589c90d",
      name: "PaymentMethod",
      required: "Optional when a default exists",
      sheets: ["Templates", "Assignments"],
      type: "GUID",
    },
  ];

  const aliases = Object.freeze({
    Start: "StartOption",
    StartDay: "PaymentDay",
  });
  const byName = new Map(fields.map((definition) => [definition.name, definition]));
  const schema = Object.freeze({
    aliases,
    assignmentFields: Object.freeze(assignmentFields),
    field: (name) => byName.get(name),
    fields: Object.freeze(fields.map(Object.freeze)),
    templateFields: Object.freeze(templateFields),
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = schema;
  } else {
    root.autoPayWorkbookSchema = schema;
  }
})(typeof window === "undefined" ? globalThis : window);
