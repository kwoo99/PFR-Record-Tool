/** Verifies PayFabric methods, endpoints, headers, and update payload rules. */
const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPayFabricClient,
} = require("../src/main/payfabric/client-core.js");

function response(status, body = {}) {
  return {
    status,
    json: async () => body,
  };
}

function createHarness(responses) {
  const requests = [];
  const fetchWithCookies = async (url, request) => {
    requests.push({ url, request });
    return responses[requests.length - 1];
  };
  const cookieJar = { getCookies: async () => [] };

  return {
    client: createPayFabricClient({ cookieJar, fetchWithCookies }),
    requests,
  };
}

test("getRecord authenticates and builds the customer endpoint", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "refreshed-token" }),
    response(200, { CustomerId: "CUST/1" }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const result = await client.getRecord("CUST/1", "customers");

  assert.deepEqual(result, {
    data: { CustomerId: "CUST/1" },
    error: null,
    status: 200,
  });
  assert.equal(
    requests[3].url,
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/customers?id=CUST%2F1",
  );
  assert.equal(
    requests[3].request.headers.Authorization,
    "Bearer refreshed-token",
  );
});

test("getPortalTimezone reads and normalizes the current portal timezone", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "portal-token" }),
    response(200, {
      displayName: "Pacific Time",
      name: "America/Los_Angeles",
    }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const timezone = await client.getPortalTimezone();

  assert.deepEqual(timezone, {
    displayName: "Pacific Time",
    name: "America/Los_Angeles",
  });
  assert.equal(
    requests[2].url,
    "https://sandbox.payfabric.com/customerportal/api/portal/api/timezone",
  );
  assert.equal(requests[2].request.method, "GET");
  assert.equal(requests[2].request.headers.Authorization, undefined);

  assert.deepEqual(await client.getPortalTimezone(), timezone);
  assert.equal(requests.length, 3);
});

test("listCustomerIds retrieves every page of the customer report", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "refreshed-token" }),
    response(200, {
      Index: 0,
      Total: 3,
      Result: [{ CustomerId: "CUST-1" }, { CustomerId: "CUST-2" }],
    }),
    response(200, {
      Index: 1,
      Total: 3,
      Result: [{ CustomerId: "CUST-3" }],
    }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const ids = await client.listCustomerIds({ pageSize: 2 });

  assert.deepEqual(ids, ["CUST-1", "CUST-2", "CUST-3"]);
  assert.equal(
    requests[3].url,
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/reports/customers?filter.pageSize=2&filter.pageIndex=0",
  );
  assert.equal(
    requests[4].url,
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/reports/customers?filter.pageSize=2&filter.pageIndex=1",
  );
});

test("listCustomerIds refuses an incomplete customer report", async () => {
  const { client } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "refreshed-token" }),
    response(200, {
      Index: 0,
      Total: 2,
      Result: [{ CustomerId: "CUST-1" }],
    }),
    response(200, { Index: 1, Total: 2, Result: [] }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });

  await assert.rejects(
    client.listCustomerIds({ pageSize: 1 }),
    /ended before every customer was loaded/,
  );
});

test("listCustomerIds stays within the portal customer page limit by default", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "refreshed-token" }),
    response(200, { Index: 0, Total: 0, Result: [] }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  await client.listCustomerIds();

  assert.equal(
    requests[3].url,
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/reports/customers?filter.pageSize=15&filter.pageIndex=0",
  );
});

test("listCustomers caps AutoPay report pages at 15 and retrieves every page", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "report-token" }),
    response(200, {
      Index: 0,
      Result: Array.from({ length: 15 }, (_, index) => ({
        CustomerId: `CUST-${index + 1}`,
      })),
      Total: 16,
    }),
    response(200, {
      Index: 1,
      Result: [{ CustomerId: "CUST-16" }],
      Total: 16,
    }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const customers = await client.listCustomers({ pageSize: 100 });

  assert.equal(customers.length, 16);
  assert.match(requests[3].url, /filter\.pageSize=15/);
  assert.match(requests[3].url, /filter\.pageIndex=0/);
  assert.match(requests[4].url, /filter\.pageSize=15/);
  assert.match(requests[4].url, /filter\.pageIndex=1/);
});

test("listCustomers sends supported portal filters and returns full rows", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "report-token" }),
    response(200, {
      Result: [
        {
          CurrencyCode: "USD",
          CustomerId: "CUST-1",
          Name: "Example",
          NextAutoPay: null,
        },
        {
          CurrencyCode: "USD",
          CustomerId: "CUST-2",
          Name: "Different Company",
          NextAutoPay: null,
        },
      ],
      Total: 2,
    }),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const customers = await client.listCustomers({
    filters: {
      currencyCode: "USD",
      customerIds: ["CUST-1", "CUST/2"],
      invoiceBalanceMin: 10,
      email: "billing@example.com",
      name: "Example",
    },
    pageSize: 100,
  });

  assert.equal(customers[0].Name, "Example");
  // The mock returns both rows; the assertion below verifies that the real
  // portal receives the exact filters that would reduce that response.
  assert.equal(customers.length, 2);
  const requestURL = new URL(requests[3].url);
  assert.equal(requestURL.searchParams.get("filter.pageSize"), "15");
  assert.equal(requestURL.searchParams.get("filter.criteria.currencyCode"), "USD");
  assert.deepEqual(
    requestURL.searchParams.getAll("filter.criteria.customerId.in"),
    ["CUST-1", "CUST/2"],
  );
  assert.equal(requestURL.searchParams.get("filter.criteria.invoiceBalance.min"), "10");
  assert.equal(
    requestURL.searchParams.get("filter.criteria.name.equalsTo"),
    "Example",
  );
  assert.equal(
    requestURL.searchParams.get("filter.criteria.email.equalsTo"),
    "billing@example.com",
  );
});

test("AutoPay requests use isolated customer impersonation tokens", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "sync-token" }),
    response(200, { access_token: "customer-a-token" }),
    response(200, { CustomerId: "CUSTOMER-A" }),
    response(200, { access_token: "customer-b-token" }),
    response(200, { CustomerId: "CUSTOMER-B" }),
  ]);
  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });

  await client.getAutoPayContract("CUSTOMER-A");
  await client.getAutoPayContract("CUSTOMER-B");

  assert.equal(
    requests[2].url,
    "https://sandbox.payfabric.com/customerportal/api/portal/api/token",
  );
  assert.equal(requests[2].request.body.get("customer_id"), "CUSTOMER-A");
  assert.equal(requests[2].request.body.get("impersonate_user"), "CUSTOMER-A");
  assert.equal(requests[3].request.headers.Authorization, "Bearer customer-a-token");
  assert.equal(requests[4].request.body.get("customer_id"), "CUSTOMER-B");
  assert.equal(requests[5].request.headers.Authorization, "Bearer customer-b-token");
});

test("AutoPay create, update, and delete use the customer portal contract endpoint", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "sync-token" }),
    response(200, { access_token: "create-token" }),
    response(200, true),
    response(200, { access_token: "update-token" }),
    response(200, true),
    response(200, { access_token: "delete-token" }),
    response(204),
  ]);
  await client.configure({
    sandbox: false,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });

  const contract = { CustomerId: "CUST-1", Frequency: "Monthly" };
  await client.createAutoPayContract("CUST-1", contract);
  await client.updateAutoPayContract("CUST-1", { CustomerId: "CUST-1" });
  await client.deleteAutoPayContract("CUST-1");

  assert.equal(requests[3].request.method, "POST");
  assert.equal(requests[3].request.body, JSON.stringify(contract));
  assert.equal(requests[5].request.method, "PATCH");
  assert.equal(requests[7].request.method, "DELETE");
  assert.equal(
    requests[7].url,
    "https://www.payfabric.com/customerportal/api/portal/api/AutoPay",
  );
});

test("deleteRecord sends the selected customer deletion scope", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "initial-token" }),
    response(200, { access_token: "full-token" }),
    response(200),
    response(200, { access_token: "partial-token" }),
    response(200),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  await client.deleteRecord("CUST/1", "Full");
  await client.deleteRecord("CUST/2", "Partial");

  assert.equal(requests[3].request.method, "DELETE");
  assert.equal(requests[3].request.body, JSON.stringify({ Scope: "Full" }));
  assert.equal(
    requests[3].url,
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/customers?id=CUST%2F1",
  );
  assert.equal(
    requests[5].request.body,
    JSON.stringify({ Scope: "Partial" }),
  );
});

test("updateRecord sends invoice IDs in the endpoint and body", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "token" }),
    response(200),
  ]);

  await client.configure({
    sandbox: false,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const recordBody = JSON.stringify({ InvoiceId: "INV 1" });
  await client.updateRecord(recordBody, "invoices", "ORIGINAL/1");

  assert.equal(
    requests[2].url,
    "https://www.payfabric.com/receivables/sync/api/portal/api/invoices?identity=ORIGINAL%2F1",
  );
  assert.equal(requests[2].request.method, "PATCH");
  assert.equal(requests[2].request.body, recordBody);
  assert.equal(requests[2].request.headers.Origin, "https://www.payfabric.com");
});

test("updateRecord omits Outstanding status from invoice balance patches", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "token" }),
    response(200),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  await client.updateRecord(
    JSON.stringify({
      InvoiceId: "INV-1",
      Balance: 125.5,
      Status: "Outstanding",
    }),
    "invoices",
    "INV-1",
  );

  assert.deepEqual(JSON.parse(requests[2].request.body), {
    InvoiceId: "INV-1",
    Balance: 125.5,
  });
});

test("updateRecord retains an editable invoice workflow status", async () => {
  const { client, requests } = createHarness([
    response(200),
    response(200, { access_token: "token" }),
    response(200),
  ]);

  await client.configure({
    sandbox: true,
    portalName: "portal",
    integrationKey: "key",
    integrationPass: "pass",
  });
  const recordBody = JSON.stringify({
    InvoiceId: "INV-2",
    Balance: 0,
    Status: "Complete",
  });
  await client.updateRecord(recordBody, "invoices", "INV-2");

  assert.equal(requests[2].request.body, recordBody);
});
