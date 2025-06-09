import dotenv from 'dotenv';
dotenv.config();

import { initDb } from '../config/db';
import { parseAndInsertExcel } from './parseExcel';

(async () => {
  const filePath = '/Users/ujjwalraj/Developer/Typescript/mdms_prs/public/excel/MDMS_PRS_Differences_BerthQualifier.xlsx';

  console.log('🔧 Creating tables...');
  await initDb();

  console.log('📦 Parsing Excel and inserting...');
  await parseAndInsertExcel(filePath);
})();
