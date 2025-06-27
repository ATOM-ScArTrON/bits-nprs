const fs = require('fs');
const { Client } = require('pg');


const client = new Client({
  user: 'your_username',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432, 
});

async function insertData() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    
    const rawData = fs.readFileSync('data.json');
    const jsonData = JSON.parse(rawData);

    for (let row of jsonData) {
      const { RouteID, City, Stop, Time } = row;
      await client.query(
        'INSERT INTO routes (RouteID, City, Stop, Time) VALUES ($1, $2, $3, $4)',
        [RouteID, City, Stop, Time]
      );
      console.log(`Inserted RouteID ${RouteID}`);
    }

    console.log("All data inserted.");
  } catch (err) {
    console.error("Error inserting data:", err);
  } finally {
    await client.end();
  }
}

insertData();
