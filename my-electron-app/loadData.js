const { readCSVFile, getCSVType } = require("./csvParser.cjs");
const CHANNELS = require("./channels.js");

async function loadData(csvFile, mainWindow) {
  try {
    const recordType = await getCSVType(csvFile);
    const recordList = await readCSVFile(csvFile, recordType);
    let recordCount = 0;
    for (const record of recordList) {
      mainWindow.webContents.send(CHANNELS.FEED_BOX, record);
      recordCount++;
    }
    mainWindow.webContents.send(CHANNELS.SELECTED_FILE_COUNT, recordCount);
    return {recordList, recordType};
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

module.exports = { loadData };
