const mysql = require('mysql2');
require('dotenv').config();


// Create connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('MySQL Connection Failed:', err.message);
    } else {
        console.log('MySQL Connected Successfully');
    }
});

module.exports = db;