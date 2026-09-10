/**
 * PayFabric request module.
 * Owns session authentication plus URL, method, header, and payload rules for
 * customer, invoice, and payment operations. Renderer code never calls the
 * network directly.
 */
const PRODUCTION_URL = "https://www.payfabric.com";
const SANDBOX_URL = "https://sandbox.payfabric.com";
const DEFAULT_CUSTOMER_PAGE_SIZE = 10;
const MAX_CUSTOMER_REPORT_PAGES = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

function createPayFabricClient({ cookieJar, fetchWithCookies }) {
  // Mutable connection state is private to this client instance.
  const session = {
    hostURL: SANDBOX_URL,
    integrationKey: "",
    integrationPass: "",
    portalName: "",
    token: undefined,
  };

  // Shared URL and header construction for every PayFabric request.
  function apiURL(resource) {
    return `${session.hostURL}/receivables/sync/api/${session.portalName}/api/${resource}`;
  }

  function browserHeaders() {
    return {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      Origin: session.hostURL,
      Referer: `${session.hostURL}/`,
    };
  }

  function authorizedHeaders() {
    return {
      ...browserHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    };
  }

  // Authentication flow. configure() is called when connection settings change.
  async function initializeSession() {
    try {
      const response = await fetchWithCookies(apiURL("token"), {
        method: "GET",
        headers: browserHeaders(),
      });
      console.log("Session init status:", response.status);

      const cookies = await cookieJar.getCookies(session.hostURL);
      console.log(
        "Session cookies:",
        cookies.map((cookie) => cookie.key),
      );
    } catch (error) {
      console.log("Session init error:", error.message);
    }
  }

  async function generateToken() {
    const form = new URLSearchParams();
    form.append("grant_type", "password");
    form.append("username", session.integrationKey);
    form.append("password", session.integrationPass);

    try {
      const response = await fetchWithCookies(apiURL("token"), {
        method: "POST",
        headers: {
          ...browserHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });

      console.log("Token response status:", response.status);
      if (response.status !== 200) {
        return null;
      }

      const result = await response.json();
      return result.access_token;
    } catch (error) {
      console.error("Token generation error:", error);
      return null;
    }
  }

  async function configure({
    integrationKey,
    integrationPass,
    portalName,
    sandbox,
  }) {
    session.hostURL = sandbox ? SANDBOX_URL : PRODUCTION_URL;
    session.portalName = portalName;
    session.integrationKey = integrationKey;
    session.integrationPass = integrationPass;

    await initializeSession();
    session.token = await generateToken();
  }

  // Record endpoint rules differ by PayFabric record type.
  function recordURL(recordId, recordType) {
    const encodedRecordId = encodeURIComponent(recordId);

    switch (recordType) {
      case "customers":
        return `${apiURL(recordType)}?id=${encodedRecordId}`;
      case "invoices":
        return `${apiURL(recordType)}?identity=${encodedRecordId}`;
      case "payments":
        return `${apiURL(recordType)}/byId?id=${encodedRecordId}`;
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }
  }

  // Record operations exposed through the client interface.
  async function getRecord(recordId, recordType) {
    session.token = await generateToken();

    try {
      const response = await fetchWithCookies(recordURL(recordId, recordType), {
        method: "GET",
        headers: authorizedHeaders(),
      });

      if (response.status !== 200) {
        return {
          data: null,
          error: `Request failed with status ${response.status}`,
          status: response.status,
        };
      }

      return {
        data: await response.json(),
        error: null,
        status: response.status,
      };
    } catch (error) {
      return { data: null, error: error.message, status: undefined };
    }
  }

  async function listCustomerIds({
    pageSize = DEFAULT_CUSTOMER_PAGE_SIZE,
  } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new Error("pageSize must be a positive integer");
    }

    session.token = await generateToken();
    if (!session.token) {
      throw new Error("Unable to authenticate before loading customers");
    }

    const customerIds = [];
    let fetchedCount = 0;

    for (let pageIndex = 0; pageIndex < MAX_CUSTOMER_REPORT_PAGES; pageIndex++) {
      const query = new URLSearchParams({
        "filter.pageSize": pageSize,
        "filter.pageIndex": pageIndex,
      });
      const response = await fetchWithCookies(
        `${apiURL("reports/customers")}?${query}`,
        {
          method: "GET",
          headers: authorizedHeaders(),
        },
      );

      if (response.status !== 200) {
        let responseMessage;
        try {
          const errorBody = await response.json();
          responseMessage = errorBody.Message ?? errorBody.message;
        } catch {
          responseMessage = undefined;
        }

        throw new Error(
          `Customer list request failed with status ${response.status}${responseMessage ? `: ${responseMessage}` : ""}`,
        );
      }

      const page = await response.json();
      if (!Array.isArray(page.Result)) {
        throw new Error("Customer list response did not contain a Result array");
      }

      const pageIds = page.Result.map((customer) => customer.CustomerId);
      if (pageIds.some((id) => typeof id !== "string" || id.trim() === "")) {
        throw new Error("Customer list response contained a missing CustomerId");
      }

      customerIds.push(...pageIds);
      fetchedCount += page.Result.length;

      const reportedTotal = Number(page.Total);
      const hasReportedTotal = Number.isFinite(reportedTotal);
      if (hasReportedTotal && fetchedCount >= reportedTotal) {
        return [...new Set(customerIds)];
      }
      if (!hasReportedTotal && page.Result.length < pageSize) {
        return [...new Set(customerIds)];
      }
      if (page.Result.length === 0) {
        throw new Error("Customer report ended before every customer was loaded");
      }
    }

    throw new Error("Customer report exceeded the pagination safety limit");
  }

  async function deleteRecord(recordId, deleteType) {
    session.token = await generateToken();
    const encodedRecordId = encodeURIComponent(recordId);

    return fetchWithCookies(`${apiURL("customers")}?id=${encodedRecordId}`, {
      method: "DELETE",
      headers: authorizedHeaders(),
      body: JSON.stringify({ Scope: deleteType }),
    });
  }

  function updateRequest(recordBody, recordType, recordId) {
    switch (recordType) {
      case "customers":
      case "payments":
        return { method: "POST", url: apiURL(recordType) };
      case "invoices": {
        const invoiceId = recordId ?? JSON.parse(recordBody).InvoiceId;
        return {
          method: "PATCH",
          url: `${apiURL(recordType)}?identity=${encodeURIComponent(invoiceId)}`,
        };
      }
      default:
        throw new Error(`Unsupported record type: ${recordType}`);
    }
  }

  function updateBody(recordBody, recordType) {
    if (recordType !== "invoices") {
      return recordBody;
    }

    const invoice = JSON.parse(recordBody);
    if (invoice.Status !== "Outstanding") {
      return recordBody;
    }

    // Outstanding can be returned by invoice lookup but is rejected as an
    // explicit PATCH status. Omitting it preserves the status during amount edits.
    delete invoice.Status;
    return JSON.stringify(invoice);
  }

  async function updateRecord(recordBody, recordType, recordId) {
    const request = updateRequest(recordBody, recordType, recordId);
    return fetchWithCookies(request.url, {
      method: request.method,
      headers: authorizedHeaders(),
      body: updateBody(recordBody, recordType),
    });
  }

  return {
    configure,
    deleteRecord,
    getRecord,
    listCustomerIds,
    updateRecord,
  };
}

module.exports = { createPayFabricClient };
