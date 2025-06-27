const XLSX = require('xlsx');
const fs = require('fs');


const workbook = XLSX.readFile('PRS_SATSANG_ROUTE.xlsx');


const sheetNames = workbook.SheetNames;

sheetNames.forEach((sheetName, index) => {
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

 
  fs.writeFileSync(`${sheetName.replace(/\s+/g, '_')}.json`, JSON.stringify(jsonData, null, 2));
  console.log(`Converted sheet "${sheetName}" to JSON file "${sheetName.replace(/\s+/g, '_')}.json"`);
});
