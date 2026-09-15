/**
 * AutoPay business workflow.
 * Verifies current state before mutation, resolves a customer's own default
 * payment method, and returns consistent outcomes for single and bulk callers.
 */
const {
  buildAutoPayContract,
  extractPaymentMethod,
  normalizeConfiguration,
  validateContract,
} = require("./contracts.js");

function createAutoPayService(client) {
  async function loadContract(customerId) {
    return client.getAutoPayContract(customerId);
  }

  async function saveContract({ contract, customerId, mode }) {
    const current = await client.getAutoPayContract(customerId);
    if (current.error && current.status !== 404) return current;
    if (mode === "create" && current.data) {
      return {
        data: null,
        error: "Customer already has an AutoPay contract. Reload the customer before continuing.",
        status: 409,
      };
    }
    if (mode === "update" && !current.data) {
      return {
        data: null,
        error: "The AutoPay contract no longer exists. Reload the customer before continuing.",
        status: 404,
      };
    }

    const normalized = normalizeConfiguration({
      ...contract,
      CustomerId: customerId,
    });
    if (mode === "create" && !normalized.PaymentMethod) {
      const method = await client.getDefaultPaymentMethod(
        customerId,
        normalized.Currency,
      );
      if (method.error) return method;
      normalized.PaymentMethod = extractPaymentMethod(method.data);
    }
    validateContract(normalized, { create: mode === "create" });
    return mode === "create"
      ? client.createAutoPayContract(customerId, normalized)
      : client.updateAutoPayContract(customerId, normalized);
  }

  async function apply(customer, options) {
    const customerId = customer.CustomerId;
    const current = await client.getAutoPayContract(customerId);
    if (current.error && current.status !== 404) {
      return failure(current.error, current.status);
    }
    if (current.data) {
      return {
        message: "Already on AutoPay; no changes made",
        outcome: "skipped",
        retryable: false,
        status: current.status,
      };
    }

    let paymentMethod = options.paymentMethod;
    if (!paymentMethod) {
      const method = await client.getDefaultPaymentMethod(
        customerId,
        customer.CurrencyCode ?? customer.Currency,
      );
      if (method.error) return failure(method.error, method.status);
      paymentMethod = extractPaymentMethod(method.data);
    }

    let contract;
    try {
      contract = buildAutoPayContract({
        configuration: options.configuration,
        customer,
        fixedAmount: options.fixedAmount,
        nextPaymentDate: options.nextPaymentDate,
        paymentMethod,
      });
    } catch (error) {
      return failure(error.message, 400);
    }

    const result = await client.createAutoPayContract(customerId, contract);
    return result.error
      ? failure(result.error, result.status)
      : {
          message: "AutoPay applied",
          outcome: "succeeded",
          retryable: false,
          status: result.status,
        };
  }

  async function remove(customer) {
    const customerId = customer.CustomerId;
    const current = await client.getAutoPayContract(customerId);
    if (current.error && current.status !== 404) {
      return failure(current.error, current.status);
    }
    if (!current.data) {
      return {
        message: "No AutoPay contract; no changes made",
        outcome: "skipped",
        retryable: false,
        status: current.status,
      };
    }

    const result = await client.deleteAutoPayContract(customerId);
    return result.error
      ? failure(result.error, result.status)
      : {
          message: "AutoPay removed",
          outcome: "succeeded",
          retryable: false,
          status: result.status,
        };
  }

  function failure(message, status) {
    return {
      message,
      outcome: "failed",
      retryable:
        status === null ||
        status === undefined ||
        status === 408 ||
        status === 429 ||
        status >= 500,
      status,
    };
  }

  return { apply, loadContract, remove, saveContract };
}

module.exports = { createAutoPayService };
