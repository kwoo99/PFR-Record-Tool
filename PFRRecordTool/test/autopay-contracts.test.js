/** Verifies AutoPay template mapping and request validation. */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildAutoPayContract,
  normalizeConfiguration,
  normalizeConfigurationPatch,
  normalizeTemplateRequest,
} = require("../src/main/autopay/contracts.js");

test("builds a customer contract from an existing portal template", () => {
  const contract = buildAutoPayContract({
    configuration: {
      AmountOption: "Outstanding",
      ApplyCredits: true,
      CurrencyOption: "CustomerCurrency",
      Description: "Monthly balance",
      Frequency: "Monthly",
      FrequencyInterval: 1,
      InvoiceTypes: ["STANDARD"],
      StartDay: 15,
    },
    customer: { CurrencyCode: "USD", CustomerId: "CUST-1" },
    nextPaymentDate: "2026-10-15T12:00:00.000Z",
    paymentMethod: "wallet-guid",
  });

  assert.deepEqual(contract, {
    AmountOption: "Outstanding",
    ApplyCredits: true,
    Currency: "USD",
    CustomerId: "CUST-1",
    Description: "Monthly balance",
    FixedAmount: 0,
    Frequency: "Monthly",
    FrequencyInterval: 1,
    InvoiceTypes: ["STANDARD"],
    NextPaymentDate: "2026-10-15T12:00:00.000Z",
    PaymentDay: 15,
    PaymentMethod: "wallet-guid",
  });
});

test("normalizes imported template fields for the Sync settings endpoint", () => {
  assert.deepEqual(
    normalizeTemplateRequest({
      AmountOption: "Outstanding",
      ApplyCredits: "yes",
      CurrencyOption: "CustomerCurrency",
      Frequency: "Monthly",
      Name: "Monthly balance",
      Start: "DayOfTheMonth",
      StartDay: "15",
    }),
    {
      AmountOption: "Outstanding",
      ApplyCredits: true,
      Frequency: "Monthly",
      InvoiceTypes: [],
      Name: "Monthly balance",
      PaymentDay: 15,
      StartOption: "DayOfTheMonth",
    },
  );
});

test("normalizes workbook-friendly values and rejects incomplete creates", () => {
  assert.deepEqual(
    normalizeConfiguration({
      ApplyCredits: "yes",
      FixedAmount: "25.50",
      FrequencyInterval: "2",
      InvoiceTypes: "STD; SERVICE",
    }),
    {
      ApplyCredits: true,
      FixedAmount: 25.5,
      FrequencyInterval: 2,
      InvoiceTypes: ["STD", "SERVICE"],
    },
  );

  assert.throws(
    () =>
      buildAutoPayContract({
        configuration: {
          AmountOption: "Outstanding",
          Frequency: "Monthly",
        },
        customer: { CustomerId: "CUST-1" },
        paymentMethod: "wallet-guid",
      }),
    /NextPaymentDate is required/,
  );
});

test("normalizes only explicit nonblank fields for an existing-contract patch", () => {
  assert.deepEqual(
    normalizeConfigurationPatch({
      AmountOption: "",
      ApplyCredits: false,
      FixedAmount: "",
      InvoiceTypes: "",
      NextPaymentDate: "2026-11-20T00:00:00.000Z",
      PaymentMethod: "",
    }),
    {
      ApplyCredits: false,
      NextPaymentDate: "2026-11-20T00:00:00.000Z",
    },
  );
});
