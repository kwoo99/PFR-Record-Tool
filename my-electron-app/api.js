// import {readCSVFile} from './csvParser.cjs';

//Define variables for Receivables portal and credentials
// var portalName = "Gorilla";
// var integrationKey = "Gorilla_JMl0qPu";
// var integrationPass = "%Hr9<US";

var portalName = "";
var integrationKey = "";
var integrationPass = "";
var tokenInfo;
// host url for production
var hostURLProd = `https://www.payfabric.com`;
// host url for sandbox
var hostURLSan = `https://sandbox.payfabric.com`;

// Determine host url
// var isTest = true;
let hostURL;
// let hostURL = hostURLSan;

function config(mode, portal, key, pass) {
  if (mode) {
    hostURL = hostURLSan;
  } else {
    hostURL = hostURLProd;
  }
  portalName = portal;
  integrationKey = key;
  integrationPass = pass;
}

// function to grab invoices
function getInvoices() {
  // build endpoint url for invoice request
  var url =
    hostURL + "/receivables/api/" + portalName + "/api/reports/payments";
  // create request
  var request = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "integration",
    },
  };
  // create fetch to send out request
}

// function to grab payments
function getPayments() {
  // build endpoint url for invoice request
  var url =
    hostURL + "/receivables/sync/api/" + portalName + "/api/reports/payments";
  // authentication
}
// function to grab customers
async function getCustomers(customers) {
  var customerList = [];
  for (let i = 0; i < customers.length; i++) {
    // build endpoint url for invoice request
    var url =
      hostURL +
      "/receivables/sync/api/" +
      portalName +
      `/api/customers?id=${customers[i]}`;
    var request = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenInfo}`,
      },
    };
    try {
      var response = await fetch(url, request);
      var json = await response.json();
      customerList.push(json.CustomerId);
    } catch (error) {
      console.error(error);
      return null;
    }
  }
  return customerList;
}


async function getRecord(recordId, recordType) {
  console.log("Record confirmed: " + recordId);
  tokenInfo = await generateToken();
  var url =
    hostURL +
    "/receivables/sync/api/" +
    portalName +
    `/api/${recordType}?id=${recordId}`;
  var request = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenInfo}`,
    },
  };
  try {
    var response = await fetch(url, request);
    console.log("debug");
    // console.log(response);
    data = await response.json();
    // console.log(response);
    console.log("Sending response");
    return { data: data, error: null, status: response.status };
  } catch (error) {
    // console.error(error);
    console.log("Returning error")
    return { data: null, error: error.message, status: response.status };
  }
}

// function to delete invoices
// build endpoint url for invoice request
// authentication

// function to delete payments
// build endpoint url for delete request
// authentication

// function to delete customer
async function deleteCustomers(customers) {
  var deleteCount = 0;
  for (let i = 0; i < customers.length; i++) {
    var url =
      hostURL +
      "/receivables/sync/api/" +
      portalName +
      `/api/customers?id=${customers[i]}`;
    var request = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenInfo}`,
      },
    };
    fetch(url, request)
      .then((response) => response.text())
      .then(() => console.log(customers[i]))
      .catch((error) => console.error(error));
  }
  console.log(deleteCount + " Customers deleted");
}
// build endpoint url for delete request
// authentication

// function to run deletion function for specified record type

// function to generate security token for authenticating api calls
async function generateToken() {
  //Creates endpoint url for generating a security token
  var url = hostURL + "/receivables/sync/api/" + portalName + "/api/token";

  //Encodes objects passed through the body by appending them to a url encoding object since content type is x-www-form-urlencoded
  var urlencoded = new URLSearchParams();
  urlencoded.append("grant_type", "password");
  urlencoded.append("username", integrationKey);
  urlencoded.append("password", integrationPass);

  //Create request object to be used as a parameter for fetch
  var request = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    //pass the urlencode object as the body
    body: urlencoded,
  };
  // create fetch to send out request passing in request and url
  try {
    var response = await fetch(url, request);
    console.log(response);
    var json = await response.json();
    return json.access_token;
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = { config, getRecord };

// async function main() {
//   // var customers = await readCSVFile(customerList);
//   tokenInfo = await generateToken();
//   // deleteCustomers(customers)
//   var customer = await getCustomer("AARONFIT0001");
//   console.log(customer);

// }

// main();
