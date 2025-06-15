const XLSX = require('xlsx');
const fs = require('fs');

// Load the workbook
const workbook = XLSX.readFile('PRS_SATSANG_ROUTE.xlsx');

// Get the sheet names
const sheetNames = workbook.SheetNames;

// Loop through each sheet and convert to JSON
sheetNames.forEach((sheetName, index) => {
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  // Write JSON to file
  fs.writeFileSync(`${sheetName.replace(/\s+/g, '_')}.json`, JSON.stringify(jsonData, null, 2));
  console.log(`Converted sheet "${sheetName}" to JSON file "${sheetName.replace(/\s+/g, '_')}.json"`);
});
