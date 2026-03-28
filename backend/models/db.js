const sql = require('mssql');
const dbConfig = require('../config/db');

let poolPromise;

async function getPool() {
    // Reuse the same pool across requests to reduce connection overhead.
    // MSSQL driver will manage pooling internally, but this prevents repeated connect calls.
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig);
    }
    return poolPromise;
}

module.exports = { getPool, sql };

