const mysql = require('mysql2');

// ── Change these to match your MySQL setup ─────────────────────────────────
const DB_CONFIG = {
    host: 'localhost',
    user: 'root',          
    password: 'kiru@123',          
    database: 'student_directory', // your database name (seen in your screenshot)
    port: 3306 
};
// ──────────────────────────────────────────────────────────────────────────

function createConnection() {
    const connection = mysql.createConnection(DB_CONFIG);

    connection.connect(function(err) {
        if (err) {
            console.error(' DB connection failed:', err.message);
            console.log('   Check host/user/password/database in db.js');
            setTimeout(createConnection, 3000); // retry after 3s
            return;
        }
        console.log(' Connected to MySQL database:', DB_CONFIG.database);
    });

    connection.on('error', function(err) {
        console.error('DB error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' ||
            err.code === 'ECONNRESET' ||
            err.code === 'ETIMEDOUT') {
            console.log('Reconnecting to DB...');
            createConnection();
        } else {
            throw err;
        }
    });

    return connection;
}

const db = createConnection();
module.exports = db;