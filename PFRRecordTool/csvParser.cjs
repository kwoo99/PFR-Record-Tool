var fs = require("fs");
var csv = require("@fast-csv/parse");

function readCSVFile(csvFile, type) {
    return new Promise((resolve, reject) => {
        var recordIDs = [];
        fs.createReadStream(csvFile)
            .pipe(csv.parse({ headers: true }))
            .on("error", (error) => reject(error))
            .on("data", (row) => {
                recordIDs.push(row[type]); 
            })
            .on("end", () => resolve(recordIDs));
    });
}

function getCSVType(csvFile) {
    return new Promise((resolve, reject) => {
      let rowType;
      const stream = fs.createReadStream(csvFile);
      
      const csvStream = csv.parseStream(stream)
        .on("error", (error) => reject(error))
        .on("data", (row) => {
          rowType = row[0];
          csvStream.pause();
          stream.removeAllListeners('data');
          resolve(rowType);
        })
        .on("end", () => {
            if (rowType === undefined) {
              reject(new Error("No data found in CSV file"));
            }
          });
    });
  }

module.exports = { readCSVFile, getCSVType };