// import {readCSVFile} from './csvParser.cjs';

//Define variables for Receivables portal and credentials
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
let recordIdType;
// let hostURL = hostURLSan;

async function config(mode, portal, key, pass) {
  if (mode) {
    hostURL = hostURLSan;
  } else {
    hostURL = hostURLProd;
  }
  portalName = portal;
  integrationKey = key;
  integrationPass = pass;
  tokenInfo = await generateToken();
}

async function getRecord(recordId, recordType) {
  tokenInfo = await generateToken();
  console.log("Record confirmed: " + recordId);
  // tokenInfo = await generateToken();
  switch(recordType){
    case "customers":
      var url =
      hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}?id=${recordId}`;
      break;
    case "invoices":
      var url =
      hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}?identity=${recordId}`;
      break;
    case "payments":
      var url =
      hostURL + "/receivables/sync/api/" + portalName + `/api/${recordType}/byId?id=${recordId}`;
      break;
  }
    console.log(url);
  var request = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenInfo}`,
    },
  };
  try {
    var response = await fetch(url, request);
    data = await response.json();
    return { data: data, error: null, status: response.status };
  } catch (error) {
    return { data: null, error: error.message, status: response.status };
  }
}

// function to delete customers
async function deleteRecord(record, deleteType) {
    const url = `${hostURL}/receivables/sync/api/${portalName}/api/customers?id=${record}`;
    console.log(deleteType);
    // console.log(url);
    const request = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenInfo}`,
      },
      body:{
        "Scope": deleteType
      }
    };

    try {
      const response = await fetch(url, request);
      console.log(response);
      return response;
      // console.log(response);
    //   if (response.ok) {
    //     console.log(`Record ${record} deleted successfully.`);
    //     return response;
    //   } else {
    //     console.error(`Failed to delete record ${record}.`);
    //     return response;
    } catch (error) {
      console.error(`Error deleting record ${recordList[i]}: `, error);
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
          Authorization: `Bearer ${tokenInfo}`,
          "Content-Type": "application/json"
        },
        body: recordBody
      }
      break;
    case 'invoices':
      url = `${hostURL}/receivables/sync/api/${portalName}/api/${recordType}?identity=${recordBody.InvoiceId}`;
      request = {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenInfo}`,
          "Content-Type": "application/json"
        },
        body: recordBody
      }
      break;
    case 'payments':
      url = `${hostURL}/receivables/sync/api/${portalName}/api/${recordType}`;
      request = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenInfo}`,
          "Content-Type": "application/json"
        },
        body: recordBody
      }
      break;
  }


  try{
    const response = await fetch(url, request);
    console.log(response);
    return response;
  } catch {
    console.error(`Error updating record`);
    return response;
  }
}

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

module.exports = { config, getRecord, deleteRecord, updateRecord };
