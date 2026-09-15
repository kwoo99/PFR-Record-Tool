/**
 * Interprets the customer report's NextAutoPay value.
 * PayFabric uses dates in 1900 as an empty schedule sentinel, so a non-empty
 * string alone is not evidence that the customer currently has AutoPay.
 */
function hasScheduledAutoPay(nextAutoPay) {
  if (!nextAutoPay) return false;

  const parsed = new Date(nextAutoPay);
  return !Number.isNaN(parsed.valueOf()) && parsed.getUTCFullYear() > 1900;
}

function withAutoPayStatus(customer) {
  const hasAutoPay = hasScheduledAutoPay(customer.NextAutoPay);
  return {
    ...customer,
    HasAutoPay: hasAutoPay,
    NextAutoPay: hasAutoPay ? customer.NextAutoPay : null,
  };
}

module.exports = { hasScheduledAutoPay, withAutoPayStatus };
