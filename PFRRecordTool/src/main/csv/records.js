/**
 * CSV loading module.
 * Owns header detection and record-ID extraction. The IPC coordinator decides
 * when successfully parsed records replace the current activity feed.
 */
const fs = require("fs");
const csv = require("@fast-csv/parse");

// Second pass: read the column selected from the first header cell.
function readCSVFile(csvFile, type) {
  return new Promise((resolve, reject) => {
    const recordIDs = [];

    fs.createReadStream(csvFile)
      .pipe(csv.parse({ headers: true }))
      .on("error", (error) => reject(error))
      .on("data", (row) => {
        recordIDs.push(row[type]);
      })
      .on("end", () => resolve(recordIDs));
  });
}

// First pass: identify which record-ID column the exported CSV contains.
function getCSVType(csvFile) {
  return new Promise((resolve, reject) => {
    let rowType;
    const stream = fs.createReadStream(csvFile);
    const csvStream = csv
      .parseStream(stream)
      .on("error", (error) => reject(error))
      .on("data", (row) => {
        rowType = row[0];
        csvStream.pause();
        stream.removeAllListeners("data");
        resolve(rowType);
      })
      .on("end", () => {
        if (rowType === undefined) {
          reject(new Error("No data found in CSV file"));
        }
      });
  });
}

// Pure CSV interface; the IPC coordinator decides when parsed data replaces UI.
async function loadData(csvFile) {
  const recordType = await getCSVType(csvFile);
  const recordList = await readCSVFile(csvFile, recordType);
  return { recordList, recordType };
}

module.exports = { loadData };
