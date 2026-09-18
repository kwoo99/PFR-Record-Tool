/**
 * Selected-customer export preparation.
 * Enriches the loaded customer report with contract or default wallet GUIDs
 * while preserving result order and capping customer-portal requests.
 */
const {
  extractContractPaymentMethod,
  extractPaymentMethod,
} = require("./contracts.js");

const MAX_CONCURRENCY = 6;

function chooseConcurrency(customerCount, requestedMaximum) {
  const maximum = Math.max(
    1,
    Math.min(
      MAX_CONCURRENCY,
      Math.floor(Number(requestedMaximum) || MAX_CONCURRENCY),
    ),
  );
  if (customerCount >= 20) return Math.min(6, maximum);
  if (customerCount >= 8) return Math.min(4, maximum);
  if (customerCount >= 3) return Math.min(2, maximum);
  return 1;
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function exportRow(customer, walletGuid, walletSource) {
  return {
    ActiveUsers: numericValue(customer.ActiveUsers),
    AutoPayStatus: customer.HasAutoPay ? "On AutoPay" : "Not on AutoPay",
    CreditBalance: numericValue(customer.CreditBalance),
    CurrencyCode: customer.CurrencyCode ?? customer.Currency ?? null,
    CustomerId: customer.CustomerId,
    Email: customer.Email ?? null,
    InvoiceBalance: numericValue(customer.InvoiceBalance),
    Name: customer.Name ?? null,
    NextAutoPay: dateValue(customer.NextAutoPay),
    PastDueBalance: numericValue(customer.PastDueBalance),
    WalletGuid: walletGuid || null,
    WalletSource: walletSource,
  };
}

async function prepareCustomerExport(
  customers,
  {
    getAutoPayContract,
    getDefaultPaymentMethod,
    maxConcurrency = MAX_CONCURRENCY,
    onProgress = () => {},
  },
) {
  if (!Array.isArray(customers) || customers.length === 0) {
    throw new Error("Select at least one customer to export");
  }
  if (typeof getDefaultPaymentMethod !== "function") {
    throw new Error("A wallet lookup function is required");
  }
  if (typeof getAutoPayContract !== "function") {
    throw new Error("An AutoPay contract lookup function is required");
  }

  // Scale large exports up while retaining a hard ceiling so customer-portal
  // authentication and wallet requests cannot grow without bound.
  const concurrency = chooseConcurrency(customers.length, maxConcurrency);
  const rows = new Array(customers.length);
  let completed = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < customers.length) {
      const index = nextIndex++;
      const customer = customers[index];
      let contractWallet;
      let contractLookupFailed = false;
      try {
        const contract = await getAutoPayContract(customer.CustomerId);
        contractLookupFailed = Boolean(contract?.error);
        if (!contractLookupFailed) {
          contractWallet = extractContractPaymentMethod(contract?.data);
        }
      } catch {
        contractLookupFailed = true;
      }

      let row;
      if (contractLookupFailed) {
        // Do not guess at a default wallet when contract presence is unknown.
        row = exportRow(customer, null, "Lookup Failed");
      } else if (contractWallet) {
        row = exportRow(customer, contractWallet, "AutoPay Contract");
      } else {
        try {
          const result = await getDefaultPaymentMethod(
            customer.CustomerId,
            customer.CurrencyCode ?? customer.Currency,
          );
          if (result?.error) {
            row = exportRow(customer, null, "Lookup Failed");
          } else {
            const walletGuid = extractPaymentMethod(result?.data);
            row = exportRow(
              customer,
              walletGuid,
              walletGuid ? "Default Payment Method" : "No Wallet Found",
            );
          }
        } catch {
          row = exportRow(customer, null, "Lookup Failed");
        }
      }
      rows[index] = row;
      completed++;
      onProgress({ completed, total: customers.length });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, customers.length) },
      () => worker(),
    ),
  );
  return rows;
}

module.exports = { MAX_CONCURRENCY, prepareCustomerExport };
