const db = require('../db'); // Replace with actual DB connection if needed

exports.getAllSatsangs = async () => {
const result = await db.query('SELECT * FROM satsangs');
return result.rows;
};

exports.getSatsangById = async (id) => {
const result = await db.query('SELECT * FROM satsangs WHERE id = $1', [id]);
return result.rows[0];
};

exports.createSatsang = async (satsang) => {
const { name, location, date } = satsang;
const result = await db.query(
'INSERT INTO satsangs (name, location, date) VALUES ($1, $2, $3) RETURNING *',
[name, location, date]
);
return result.rows[0];
};
