//!!!! Before you run the script, please read the comments first.

//1. Make sure the "Delete Payments" is enabled in Receivables Management Portal> Settings> Payment> Preferences
//2. Make sure the "Allow Delete" is enabled in Receivables Management Portal> Settings> Invoice> Setup
//3. If any of the invoices are currently associated with InProgress or sending payments, then they will fail to be deleted.
//4. For your reference: It took 45 mins to delete 10,000 invoices in the testing environment.

//How to run scripts
//1. Login PayFabric
//2. Select the desired organization, and select Receivables service (!!!IMPORTANT)
//3. Press F12 if you are using Chrome, Edge, or Firefox, then it will open the DevTools.
//4. Select the "Console" tab, change the javascript context from top to portalIFrame at the left top corner.
//5. Paste the below scripts in Console, then press ENTER button on the keyboard to run it.
//6. Wait until you see "Completed" in the message. It will also point out how many invoices and payments were deleted.

var host = this.window.location.origin;
var portalName = sessionStorage.getItem("management_deeplink").replace(/"/ig, "");
var next = null;
var processing = false;

$._delete = function (url, data, errorfunc) {
	return $.ajax({
		url: url,
		type: "delete",
		data: data,
		error: $.noop
	});
};

$._get = function (url, data, errorfunc) {
	return $.ajax({
		url: url,
		type: "get",
		data: data,
		error: $.noop
	});
};

var log = function (message) {
	if ($("#message").length == 0) {
		$("body").append($("<div id='message' style='position:fixed;z-index:9999999999;width:600px;height:300px;left:calc(50% - 300px);top:calc(50% - 150px);padding:15px;border-radius:5px;background:#333;color:white'>Start to delete invoice and payments</div>"))
	}
	if ($("#message div").length > 8) {
		$("#message div").first().remove();
	}
	$("#message").append($("<div>" + message + "</div>"));
};

var invoices = [];
var deletedInvoicesCount = 0;
var collectCustomerInvoice = function (pageIndex) {
	processing = true;
	log("Collecting invoices,reading page " + (pageIndex + 1));
	var url = host + "/receivables/api/" + portalName + "/api/reports/invoices";
	$._get(url, { criteria: {}, pageIndex: pageIndex, pageSize: 10 })
		.then(function (response) {
			for (var i in response.result) {
				invoices.push(response.result[i]);
			}
			if (response.result.length > 0) {
				//read next page
				next = collectCustomerInvoice.bind(this, ++pageIndex);
			} else {
				//already read all of the invoices
				next = deleteCustomerInvoice;
			}
			processing = false;
		}, function () {
			next = collectCustomerInvoice.bind(this, ++pageIndex);
			processing = false;
		});
}

var deleteCustomerInvoice = function () {
	processing = true;
	var invoice = invoices.pop();
	if (invoice == null) {
		next = collectCustomerPayments.bind(this,  0);
		processing = false;
		return;
	}

	var url = host + "/receivables/api/" + portalName + "/api/reports/invoices/delete?includeReversal=false"
	$._delete(url, JSON.stringify([invoice.identity])).then(function () {
		log("deleted invoice " + invoice.identity);
		deletedInvoicesCount++;
		var deletedInvoices = JSON.parse(localStorage.getItem("deleted_invoices") || "[]");
		deletedInvoices.push(invoice.identity);
		localStorage.setItem("deleted_invoices", JSON.stringify(deletedInvoices));
		next = deleteCustomerInvoice;
		processing = false;
	},function(){
		next = deleteCustomerInvoice;
		processing = false;
	});
}

var payments = [];
var deletedPaymentsCount = 0;
var collectCustomerPayments = function (pageIndex) {
	log("Collecting payments,reading page " + (pageIndex + 1));
	processing = true;
	var url = host + "/receivables/api/" + portalName + "/api/reports/payments";
	$._get(url, { criteria: { }, pageIndex: pageIndex, pageSize: 10 })
		.then(function (response) {
			for (var i in response.result) {
				payments.push(response.result[i]);
			}
			if (response.result.length > 0) {
				//read next page
				next = collectCustomerPayments.bind(this, ++pageIndex);
			} else {
				//already read all of the payments
				next = deleteCustomerPayments;
			}
			processing = false;
		}, function () {
			next = collectCustomerPayments.bind(this, ++pageIndex);
			processing = false;
		});
}

var deleteCustomerPayments = function () {
	processing = true;
	var payment = payments.pop();
	if (payment == null) {		
		next = null;
		processing = false;
		return;
	}
	var url = host + "/receivables/api/" + portalName + "/api/reports/payments?includeReversal=false";
	
	$._delete(url, JSON.stringify([{ "paymentIdentity": payment.identity, "rowVersion": payment.rowVersion }]))
		.then(function () {
			log("deleted payment " + payment.identity);
			deletedPaymentsCount++;
			var deletedPayments = JSON.parse(localStorage.getItem("deleted_payments") || "[]");
			deletedPayments.push(payment.identity);
			localStorage.setItem("deleted_payments", JSON.stringify(deletedPayments));
			next = deleteCustomerPayments;
			processing = false;
		},function(){
			next = deleteCustomerPayments;
			processing = false;
		});
}

function refreshToken() {
	var instanceId = JSON.parse(sessionStorage.getItem('management_instanceid'));
	var deeplink = JSON.parse(sessionStorage.getItem('management_deeplink'));
	var orgname = JSON.parse(sessionStorage.getItem('management_orgname'));
	var partnerInstIdFromImpersonate = JSON.parse(sessionStorage.getItem('management_partner_inst_id_from_impersonate'));
	$.ajax({
		method: "Get",
		url: host + "/receivables/auth/token",
		data: {
			instanceId: instanceId,
			deeplink: deeplink,
			orgname: orgname,
			partnerInstIdFromImpersonate: partnerInstIdFromImpersonate
		},
		success: function (response) {
			sessionStorage.setItem("access_token", JSON.stringify(response));
			sessionStorage.setItem('expires_in', JSON.stringify(response.expires_in));
			var timeout = new Date(new Date().getTime() + response.expires_in * 1000);
			sessionStorage.setItem('token_timeout', JSON.stringify(timeout));
		},
		//override global ajax setup, to avoid dead loop
		complete: $.noop
	})
}

function refreshPFSTSCookie() {
	return $.ajax({
		method: "Get",
		dataType: "text",
		url: host + "/Portal/Account/ReNewSTSCookie",
		xhrFields: { withCredentials: true },
		//override global ajax setup, to avoid dead loop
		complete: $.noop
	});
}

var next = collectCustomerInvoice.bind(this, 0);

var logout = new Date();
var interval = setInterval(function () {
	if ((new Date() - logout) > 5 * 60 * 1000) {
		refreshToken();
		refreshPFSTSCookie();
		logout = new Date();
	}
	if (processing == false) {
		if (next != null) {
			next();
		} else {
			log("Completed, deleted " + deletedInvoicesCount + ' invoices, ' + deletedPaymentsCount + ' payments')
			clearInterval(interval);
		}
	}
}, 10)