/**
 * PayFabric request module.
 * Owns session authentication plus URL, method, header, and payload rules for
 * customer, invoice, and payment operations. Renderer code never calls the
 * network directly.
 */
const PRODUCTION_URL = "https://www.payfabric.com";
const SANDBOX_URL = "https://sandbox.payfabric.com";
// Twenty matches the report's normal UI-sized pages. Some PayFabric
// environments enforce a different accepted range, which listCustomers handles.
const DEFAULT_CUSTOMER_PAGE_SIZE = 20;
const CUSTOMER_PAGE_SIZE_FALLBACKS = [25, 50, 100];
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
    portalTimezone: undefined,
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

  function authorizedHeaders(token = session.token) {
    return {
      ...browserHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function customerPortalURL(resource) {
    return `${session.hostURL}/customerportal/api/${session.portalName}/api/${resource}`;
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
    session.portalTimezone = undefined;

    await initializeSession();
    session.token = await generateToken();
  }

  function normalizePortalTimezone(payload) {
    if (payload?.data) return normalizePortalTimezone(payload.data);
    if (typeof payload === "string" && payload.trim()) {
      return { displayName: payload.trim(), name: payload.trim() };
    }
    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
      return null;
    }

    const name = [
      payload.name,
      payload.Name,
      payload.timeZone,
      payload.TimeZone,
      payload.timezone,
      payload.Timezone,
      payload.id,
      payload.Id,
    ].find((value) => typeof value === "string" && value.trim());
    if (!name) return null;

    const displayName = [
      payload.displayName,
      payload.DisplayName,
      payload.text,
      payload.Text,
      payload.label,
      payload.Label,
      name,
    ].find((value) => typeof value === "string" && value.trim());
    return { displayName: displayName.trim(), name: name.trim() };
  }

  async function getPortalTimezone() {
    if (session.portalTimezone !== undefined) return session.portalTimezone;

    const response = await fetchWithCookies(
      customerPortalURL("timezone"),
      {
        method: "GET",
        headers: browserHeaders(),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (response.status !== 200) {
      throw new Error(
        await readError(
          response,
          `Portal timezone request failed with status ${response.status}`,
        ),
      );
    }

    const timezone = normalizePortalTimezone(await response.json());
    if (!timezone) {
      throw new Error("Portal timezone response did not contain a timezone name");
    }
    session.portalTimezone = timezone;
    return timezone;
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

  function addCustomerFilters(query, filters = {}) {
    const filterNames = {
      activeUsersMax: "filter.criteria.activeUsers.max",
      activeUsersMin: "filter.criteria.activeUsers.min",
      creditBalanceMax: "filter.criteria.creditBalance.max",
      creditBalanceMin: "filter.criteria.creditBalance.min",
      currencyCode: "filter.criteria.currencyCode",
      customerId: "filter.criteria.customerId.equalsTo",
      email: "filter.criteria.email.equalsTo",
      invoiceBalanceMax: "filter.criteria.invoiceBalance.max",
      invoiceBalanceMin: "filter.criteria.invoiceBalance.min",
      name: "filter.criteria.name.equalsTo",
      nextAutoPayMax: "filter.criteria.nextAutoPay.max",
      nextAutoPayMin: "filter.criteria.nextAutoPay.min",
      pastDueBalanceMax: "filter.criteria.pastDueBalance.max",
      pastDueBalanceMin: "filter.criteria.pastDueBalance.min",
      sortDirection: "filter.criteria.sortBy.direction",
      sortField: "filter.criteria.sortBy.field",
    };

    for (const [name, parameter] of Object.entries(filterNames)) {
      const value = filters[name];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        query.append(parameter, String(value).trim());
      }
    }

    const customerIds = Array.isArray(filters.customerIds)
      ? filters.customerIds
      : [];
    for (const customerId of customerIds) {
      if (String(customerId).trim()) {
        query.append("filter.criteria.customerId.in", String(customerId).trim());
      }
    }
  }

  async function readError(response, fallback) {
    try {
      const body = await response.json();
      return body.Message ?? body.message ?? body.Error ?? body.error ?? fallback;
    } catch {
      return fallback;
    }
  }

  async function listCustomers({
    filters = {},
    pageSize = DEFAULT_CUSTOMER_PAGE_SIZE,
  } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new Error("pageSize must be a positive integer");
    }

    session.token = await generateToken();
    if (!session.token) {
      throw new Error("Unable to authenticate before loading customers");
    }

    const customers = [];
    let fetchedCount = 0;
    let activePageSize = pageSize;

    async function requestPage(pageIndex, requestPageSize) {
      const query = new URLSearchParams({
        "filter.pageSize": requestPageSize,
        "filter.pageIndex": pageIndex,
      });
      addCustomerFilters(query, filters);
      return fetchWithCookies(`${apiURL("reports/customers")}?${query}`, {
        method: "GET",
        headers: authorizedHeaders(),
      });
    }

    for (let pageIndex = 0; pageIndex < MAX_CUSTOMER_REPORT_PAGES; pageIndex++) {
      let response = await requestPage(pageIndex, activePageSize);
      let responseMessage;

      // PayFabric deployments have returned different allowed page-size
      // ranges. On the first page only, recover from that validation response
      // and keep the accepted size for every following page.
      if (pageIndex === 0 && response.status !== 200) {
        responseMessage = await readError(response);
        if (/page\s*size|pagesize/i.test(responseMessage ?? "")) {
          for (const fallback of CUSTOMER_PAGE_SIZE_FALLBACKS) {
            if (fallback === activePageSize) continue;
            response = await requestPage(pageIndex, fallback);
            if (response.status === 200) {
              activePageSize = fallback;
              responseMessage = undefined;
              break;
            }
            responseMessage = await readError(response);
            if (!/page\s*size|pagesize/i.test(responseMessage ?? "")) break;
          }
        }
      }

      if (response.status !== 200) {
        responseMessage ??= await readError(response);

        throw new Error(
          `Customer list request failed with status ${response.status}${responseMessage ? `: ${responseMessage}` : ""}`,
        );
      }

      const page = await response.json();
      if (!Array.isArray(page.Result)) {
        throw new Error("Customer list response did not contain a Result array");
      }

      if (
        page.Result.some(
          (customer) =>
            typeof customer.CustomerId !== "string" ||
            customer.CustomerId.trim() === "",
        )
      ) {
        throw new Error("Customer list response contained a missing CustomerId");
      }

      customers.push(...page.Result);
      fetchedCount += page.Result.length;

      const reportedTotal = Number(page.Total);
      const hasReportedTotal = Number.isFinite(reportedTotal);
      if (hasReportedTotal && fetchedCount >= reportedTotal) {
        return deduplicateCustomers(customers);
      }
      if (!hasReportedTotal && page.Result.length < activePageSize) {
        return deduplicateCustomers(customers);
      }
      if (page.Result.length === 0) {
        throw new Error("Customer report ended before every customer was loaded");
      }
    }

    throw new Error("Customer report exceeded the pagination safety limit");
  }

  function deduplicateCustomers(customers) {
    return [
      ...new Map(customers.map((customer) => [customer.CustomerId, customer])).values(),
    ];
  }

  async function listCustomerIds(options = {}) {
    const customers = await listCustomers(options);
    return customers.map((customer) => customer.CustomerId);
  }

  // Customer Portal AutoPay calls require a token scoped to one customer. The
  // token is returned to the current request and never stored in shared state.
  async function generateCustomerPortalToken(customerId) {
    const normalizedCustomerId = String(customerId ?? "").trim();
    if (!normalizedCustomerId) {
      throw new Error("A customer ID is required for AutoPay access");
    }

    const form = new URLSearchParams();
    form.append("grant_type", "password");
    form.append("username", session.integrationKey);
    form.append("password", session.integrationPass);
    form.append("customer_id", normalizedCustomerId);
    form.append("impersonate_user", normalizedCustomerId);

    const response = await fetchWithCookies(customerPortalURL("token"), {
      method: "POST",
      headers: {
        ...browserHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    if (response.status !== 200) {
      const message = await readError(
        response,
        `Customer authentication failed with status ${response.status}`,
      );
      throw new Error(message);
    }

    const result = await response.json();
    if (!result.access_token) {
      throw new Error("Customer authentication returned no access token");
    }
    return result.access_token;
  }

  async function customerPortalRequest(customerId, resource, options = {}) {
    const token = await generateCustomerPortalToken(customerId);
    const response = await fetchWithCookies(customerPortalURL(resource), {
      method: options.method ?? "GET",
      headers: authorizedHeaders(token),
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });

    const successful = response.status >= 200 && response.status < 300;
    if (!successful) {
      return {
        data: null,
        error: await readError(
          response,
          `AutoPay request failed with status ${response.status}`,
        ),
        status: response.status,
      };
    }

    if (response.status === 204) {
      return { data: null, error: null, status: response.status };
    }

    try {
      return { data: await response.json(), error: null, status: response.status };
    } catch {
      return { data: null, error: null, status: response.status };
    }
  }

  async function getAutoPayContract(customerId) {
    const result = await customerPortalRequest(customerId, "AutoPay");
    if (result.status === 404) {
      return { data: null, error: null, status: result.status };
    }
    if (
      result.data === false ||
      (result.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data) &&
        Object.keys(result.data).length === 0)
    ) {
      return { ...result, data: null };
    }
    return result;
  }

  function listAutoPayTemplates(customerId) {
    return customerPortalRequest(customerId, "AutoPayTemplates");
  }

  function getDefaultPaymentMethod(customerId, currencyCode) {
    const query = new URLSearchParams();
    if (currencyCode) {
      query.set("currencyCode", currencyCode);
    }
    return customerPortalRequest(
      customerId,
      `paymentmethods/default?${query}`,
    );
  }

  function createAutoPayContract(customerId, contract) {
    return customerPortalRequest(customerId, "AutoPay", {
      body: contract,
      method: "POST",
    });
  }

  function updateAutoPayContract(customerId, contract) {
    return customerPortalRequest(customerId, "AutoPay", {
      body: contract,
      method: "PATCH",
    });
  }

  function deleteAutoPayContract(customerId) {
    return customerPortalRequest(customerId, "AutoPay", {
      method: "DELETE",
    });
  }

  async function saveAutoPayTemplate(template) {
    session.token = await generateToken();
    if (!session.token) {
      return { data: null, error: "Unable to authenticate", status: null };
    }

    const response = await fetchWithCookies(
      apiURL("settings/payment/autopaytemplates"),
      {
        body: JSON.stringify(template),
        headers: authorizedHeaders(),
        method: "POST",
      },
    );
    const successful = response.status >= 200 && response.status < 300;
    return {
      data: successful ? await response.json().catch(() => null) : null,
      error: successful
        ? null
        : await readError(
            response,
            `Template request failed with status ${response.status}`,
          ),
      status: response.status,
    };
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
    createAutoPayContract,
    deleteRecord,
    deleteAutoPayContract,
    getAutoPayContract,
    getDefaultPaymentMethod,
    getPortalTimezone,
    getRecord,
    listAutoPayTemplates,
    listCustomers,
    listCustomerIds,
    saveAutoPayTemplate,
    updateAutoPayContract,
    updateRecord,
  };
}

module.exports = { createPayFabricClient };
