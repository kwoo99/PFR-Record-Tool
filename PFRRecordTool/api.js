const tough = require('tough-cookie');
const fetchCookieModule = require('fetch-cookie');
const fetchCookie = fetchCookieModule.default || fetchCookieModule;
const cookieJar = new tough.CookieJar();
const fetchWithCookies = fetchCookie(fetch, cookieJar);

//Define variables for Receivables portal and credentials
var portalName = "";
var integrationKey = "";
var integrationPass = "";
var tokenInfo;
// host url for production
var hostURLProd = `https://www.payfabric.com`;
// host url for sandbox
var hostURLSan = `https://sandbox.payfabric.com`;

let hostURL;
let recordIdType;

async function initSession() {
  try {
    console.log("Initializing session...");
    const response = await fetchWithCookies(`${hostURL}/receivables/sync/api/${portalName}/api/token`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Origin': 'https://sandbox.payfabric.com',
        'Referer': 'https://sandbox.payfabric.com/'
      }
    });
    console.log("Session init status:", response.status);
    const cookies = await cookieJar.getCookies(hostURL);
    console.log("Cookies after init:", cookies.map(c => `${c.key}=${c.value}`));
  } catch (error) {
    console.log("Session init error:", error.message);
  }
}

async function config(mode, portal, key, pass) {
  if (mode) {
    hostURL = hostURLSan;
  } else {
    hostURL = hostURLProd;
  }
  portalName = portal;
  integrationKey = key;
  integrationPass = pass;
  await initSession();
  tokenInfo = await generateToken();
}

async function getRecord(recordId, recordType) {
  const encodedRecordId = encodeURIComponent(recordId);
  tokenInfo = await generateToken();
  console.log("Record confirmed: " + encodedRecordId);
  switch(recordType){
    case "customers":
      var url = hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}?id=${encodedRecordId}`;
      break;
    case "invoices":
      var url = hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}?identity=${encodedRecordId}`;
      break;
    case "payments":
      var url = hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}/byId?id=${encodedRecordId}`;
      break;
  }
  console.log(url);
  var request = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenInfo}`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Origin": "https://sandbox.payfabric.com",
      "Referer": "https://sandbox.payfabric.com/"
    },
  };
  try {
    var response = await fetchWithCookies(url, request);
    console.log("Raw response status:", response.status);
    if (response.status !== 200) {
      console.error("getRecord failed with status:", response.status);
      return { data: null, error: `Request failed with status ${response.status}`, status: response.status };
    }
    data = await response.json();
    return { data: data, error: null, status: response.status };
  } catch (error) {
    return { data: null, error: error.message, status: response.status };
  }
}

async function deleteRecord(record, deleteType) {
  tokenInfo = await generateToken();
  const encodedRecord = encodeURIComponent(record);
  const url = `${hostURL}/receivables/sync/api/${portalName}/api/customers?id=${encodedRecord}`;
  console.log(deleteType);
  const request = {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenInfo}`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Origin": "https://sandbox.payfabric.com",
      "Referer": "https://sandbox.payfabric.com/"
    },
    body: JSON.stringify({
      "Scope": deleteType
    })
  };
  try {
    const response = await fetchWithCookies(url, request);
    console.log("Delete response status:", response.status);
    return response;
  } catch (error) {
    console.error(`Error deleting record ${record}: `, error);
    return response;
  }
}

async function updateRecord(recordBody, recordType) {
  let url;
  let request;
  switch(recordType){
    case 'customers':
      url = `${hostURL}/receivables/sync/api/${portalName}/api/${recordType}`;
      request = {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenInfo}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Origin": "https://sandbox.payfabric.com",
          "Referer": "https://sandbox.payfabric.com/"
        },
        body: recordBody
      }
      break;
    case 'invoices':
      url = `${hostURL}/receivables/sync/api/${portalName}/api/${recordType}?identity=${recordBody.InvoiceId}`;
      request = {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${tokenInfo}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Origin": "https://sandbox.payfabric.com",
          "Referer": "https://sandbox.payfabric.com/"
        },
        body: recordBody
      }
      break;
    case 'payments':
      url = `${hostURL}/receivables/sync/api/${portalName}/api/${recordType}`;
      request = {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenInfo}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Origin": "https://sandbox.payfabric.com",
          "Referer": "https://sandbox.payfabric.com/"
        },
        body: recordBody
      }
      break;
  }
  try {
    const response = await fetchWithCookies(url, request);
    console.log(response);
    return response;
  } catch {
    console.error(`Error updating record`);
    return response;
  }
}

async function generateToken() {
  var url = hostURL + "/receivables/sync/api/" + portalName + "/api/token";
  var urlencoded = new URLSearchParams();
  urlencoded.append("grant_type", "password");
  urlencoded.append("username", integrationKey);
  urlencoded.append("password", integrationPass);
  var request = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Origin": hostURL,
      "Referer": hostURL + "/"
    },
    body: urlencoded,
  };
  try {
    var response = await fetchWithCookies(url, request);
    console.log("Token response status:", response.status);
    if (response.status !== 200) {
      console.error("Token request failed with status:", response.status);
      return null;
    }
    var json = await response.json();
    console.log("Token result:", json.access_token ? "Token received" : "Token FAILED");
    return json.access_token;
  } catch (error) {
    console.error("Token generation error:", error);
    return null;
  }
}

module.exports = { config, getRecord, deleteRecord, updateRecord };