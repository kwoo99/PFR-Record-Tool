//Define variables for Receivables portal and credentials
portalName = "Kyle";
var integrationKey = "Kyle_Ci0pW46";
var integrationPass = ".Wu62/?";
var tokenInfo;
// host url for production
var hostURLProd = `https://www.payfabric.com`;
// host url for sandbox
var hostURLSan = `https://sandbox.payfabric.com`;

// Determine host url
var isTest = true;
var hostURL;

if (isTest) {
  hostURL = hostURLSan;
} else {
  hostURL = hostURLProd;
}

// function to grab invoices
function getInvoices() {
  // build endpoint url for invoice request
  var url = hostURL + "/receivables/api/" + portalName + "/api/reports/payments";
  // create request
  var request = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "integration",
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
    var url = hostURL + "/receivables/sync/api/" + portalName + `/api/customers?id=${customers[i]}`;
    var request = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenInfo}`,
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

// function to delete invoices
// build endpoint url for invoice request
// authentication

// function to delete payments
// build endpoint url for delete request
// authentication

// function to delete customer
async function deleteCustomers(customers) {
  //   for (let i = 0; i < customerList.length; i++) {
  //     var url =
  //       hostURL +
  //       "/receivables/sync/api/" +
  //       portalName +
  //       `api/customers?id=${customerList[i]}`;
  //     var request = {
  //       method: "DELETE",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "Authorization": `Bearer ${tokenInfo}`,
  //       },
  //     };
  //   }
  var url = hostURL + "/receivables/sync/api/" + portalName + "/api/customers?id=PFC000015";
  var request = {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokenInfo}`,
    },
  };
  fetch(url, request)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.error(error));
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
    var json = await response.json();
    return json.access_token;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function main() {
  //Test that generateToken function works
  var custos = ["AARONFIT0001", "ADAMPARK0001"];
  tokenInfo = await generateToken();
  customer_List = await getCustomers(custos);
  await deleteCustomers();
}

main();
