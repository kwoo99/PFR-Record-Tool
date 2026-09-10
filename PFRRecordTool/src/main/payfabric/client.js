/**
 * Production adapter for the PayFabric request module.
 * Wires the testable client implementation to the real fetch and cookie jar.
 */
const fetchCookieModule = require("fetch-cookie");
const { CookieJar } = require("tough-cookie");

const { createPayFabricClient } = require("./client-core.js");

const fetchCookie = fetchCookieModule.default || fetchCookieModule;
const cookieJar = new CookieJar();

module.exports = createPayFabricClient({
  cookieJar,
  fetchWithCookies: fetchCookie(fetch, cookieJar),
});
