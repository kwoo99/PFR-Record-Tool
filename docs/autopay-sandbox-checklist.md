# AutoPay Sandbox Verification

Use a dedicated Sandbox portal and test customers. Do not use Production for the
first verification pass.

## Preparation

- Confirm the integration user can read customer reports and impersonate test
  customers.
- Prepare one customer with an AutoPay contract, one without a contract but with
  a default payment method, and one without a usable default payment method.
- Note the original contract values so the test data can be restored.

## Customer discovery

1. Save the Sandbox connection and open AutoPay.
2. Fetch without filters, then try customer ID, name, currency, balance, and date
   filters.
3. Verify All, On AutoPay, and Not on AutoPay counts against the portal report.
4. Search the loaded table and confirm selection follows all matching results,
   including lists larger than 500 rows.

## Individual contracts

1. Open the customer with a contract and compare every displayed value with the
   portal.
2. Confirm the schedule indicator shows the same process day as the portal and a
   12:00 AM (00:00) start with the portal's current timezone shown by name.
3. If the timezone displays as unavailable, confirm the configured portal name
   opens successfully in the PayFabric Customer Portal.
4. Change one non-destructive field, save, and verify it in the portal.
5. Open the customer without a contract, provide a future date and valid terms,
   leave the payment method blank, and verify the default wallet is used.
6. Remove that new contract and verify it no longer appears in the portal.

## Templates and bulk work

1. Load portal templates and apply one to two customers without contracts.
2. Confirm customers with existing contracts are skipped and unchanged.
3. Apply a valid JSON configuration, then save a uniquely named Sandbox template.
4. Import a workbook with `Templates` and `Assignments` sheets. Verify per-customer
   dates and payment methods are respected.
5. Start a larger Sandbox cycle, pause it, confirm in-flight work settles, and
   continue the untouched customers.
6. Create a temporary retryable failure if practical, finish the cycle, and retry
   only temporary failures.
7. Remove AutoPay from selected test customers and confirm customers without a
   contract are skipped.

## Release gate

- Compare the final changed/skipped/failed counts with portal state.
- Restore test customers to their original state.
- Do not enable Production use until every mutation above has succeeded with the
  expected request and portal result.
