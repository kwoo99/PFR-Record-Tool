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

test("listCustomerIds uses the documented customer report page size by default", async () => {
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
    "https://sandbox.payfabric.com/receivables/sync/api/portal/api/reports/customers?filter.pageSize=10&filter.pageIndex=0",
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
