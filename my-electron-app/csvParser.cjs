var fs = require("fs");
var csv = require("fast-csv");

function readCSVFile(csvFile) {
    return new Promise((resolve, reject) => {
        var customerIDs = [];

        fs.createReadStream(csvFile)
            .pipe(csv.parse({ headers: true }))
            .on("error", (error) => reject(error))
            .on("data", (row) => {
                customerIDs.push(row["Customer ID"]);
            })
            .on("end", () => resolve(customerIDs));
    });
}

module.exports = { readCSVFile };